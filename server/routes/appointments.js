const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('admin', 'receptionist', 'doctor', 'patient'), async (req, res, next) => {
  try {
    const { date, status } = req.query;
    const { role, doctor_id, patient_id } = req.user;

    const onlyDoctor  = role === 'doctor'  ? doctor_id  : null;
    const onlyPatient = role === 'patient' ? patient_id : null;

    const result = await db.query(
      `SELECT a.appt_id, a.appt_date, a.time_slot, a.status,
              p.patient_id, p.name AS patient_name, p.phone,
              d.doctor_id, d.name AS doctor_name, dep.dept_name
       FROM appointment a
       JOIN patient p       ON a.patient_id = p.patient_id
       JOIN doctor d        ON a.doctor_id  = d.doctor_id
       JOIN department dep  ON d.dept_id    = dep.dept_id
       WHERE ($1::date IS NULL OR a.appt_date = $1)
         AND ($2::text IS NULL OR a.status    = $2)
         AND ($3::int  IS NULL OR a.doctor_id  = $3)
         AND ($4::int  IS NULL OR a.patient_id = $4)
       ORDER BY a.appt_date DESC, a.time_slot`,
      [date || null, status || null, onlyDoctor, onlyPatient]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/available-slots', requireAuth, async (req, res, next) => {
  try {
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      return res.status(400).json({ error: 'doctor_id and date are required' });
    }

    const result = await db.query(
      `SELECT ds.schedule_id,
              ds.chamber_no,
              ds.day_of_week,
              slot_ts::time AS slot_time
       FROM doctor_schedule ds
       CROSS JOIN LATERAL generate_series(
           ($2::date + ds.start_time),
           ($2::date + ds.end_time - (ds.slot_duration || ' minutes')::interval),
           ((ds.slot_duration || ' minutes')::interval)
       ) AS slot_ts
       WHERE ds.doctor_id  = $1
         AND ds.is_active  = TRUE
         AND ds.day_of_week = TRIM(TO_CHAR($2::date, 'Day'))
         AND NOT EXISTS (
             SELECT 1 FROM appointment a
             WHERE a.doctor_id = $1
               AND a.appt_date = $2
               AND a.time_slot = slot_ts::time
               AND a.status <> 'Cancelled'
         )
       ORDER BY slot_ts`,
      [doctor_id, date]
    );

    res.json({
      doctor_id: Number(doctor_id),
      date,
      slots: result.rows
    });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const appt = await db.query(
      `SELECT a.appt_id, a.appt_date, a.time_slot, a.status,
              p.patient_id, p.name AS patient_name, p.phone,
              d.doctor_id, d.name AS doctor_name, dep.dept_name
       FROM appointment a
       JOIN patient p      ON a.patient_id = p.patient_id
       JOIN doctor d       ON a.doctor_id  = d.doctor_id
       JOIN department dep ON d.dept_id    = dep.dept_id
       WHERE a.appt_id = $1`,
      [req.params.id]
    );

    if (appt.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const { role, patient_id } = req.user;
    if (role === 'patient' && appt.rows[0].patient_id !== patient_id) {
      return res.status(403).json({ error: 'You can only access your own appointments' });
    }

    const presc = await db.query(
      `SELECT presc_id, presc_date, diagnosis FROM prescription WHERE appt_id = $1`,
      [req.params.id]
    );

    res.json({ ...appt.rows[0], prescription: presc.rows[0] || null });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { patient_id, doctor_id, schedule_id, appt_date, time_slot } = req.body;

    if (!patient_id || !doctor_id || !appt_date || !time_slot) {
      return res.status(400).json({
        error: 'Patient, doctor, date and time slot are required'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const wanted = new Date(appt_date);
    wanted.setHours(0, 0, 0, 0);

    if (wanted < today) {
      return res.status(400).json({
        error: 'An appointment cannot be booked for a date in the past'
      });
    }

    const booked = await db.withTransaction(async (client) => {
      if (schedule_id) {
        const sched = await client.query(
          `SELECT ds.schedule_id, ds.doctor_id, ds.day_of_week,
                  ds.start_time, ds.end_time, ds.max_patients, ds.is_active,
                  TRIM(TO_CHAR($2::date, 'Day')) AS booking_day
           FROM doctor_schedule ds
           WHERE ds.schedule_id = $1
           FOR UPDATE`,
          [schedule_id, appt_date]
        );

        if (sched.rows.length === 0) {
          throw { status: 404, message: 'That chamber slot does not exist' };
        }

        const sc = sched.rows[0];

        if (Number(sc.doctor_id) !== Number(doctor_id)) {
          throw { status: 400, message: 'That chamber slot belongs to a different doctor' };
        }
        if (!sc.is_active) {
          throw { status: 409, message: 'That chamber slot is not active' };
        }
        if (sc.day_of_week !== sc.booking_day) {
          throw {
            status: 400,
            message: `This doctor sits on ${sc.day_of_week}, but that date is a ${sc.booking_day}`
          };
        }
        if (time_slot < sc.start_time || time_slot >= sc.end_time) {
          throw {
            status: 400,
            message: `Chamber hours are ${sc.start_time} to ${sc.end_time}`
          };
        }

        const taken = await client.query(
          `SELECT COUNT(*) AS n FROM appointment
           WHERE schedule_id = $1 AND appt_date = $2 AND status <> 'Cancelled'`,
          [schedule_id, appt_date]
        );

        if (Number(taken.rows[0].n) >= Number(sc.max_patients)) {
          throw {
            status: 409,
            message: `This chamber is full for that day — ${sc.max_patients} patients already booked`
          };
        }
      }

      const result = await client.query(
        `INSERT INTO appointment
           (patient_id, doctor_id, schedule_id, appt_date, time_slot)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [patient_id, doctor_id, schedule_id || null, appt_date, time_slot]
      );
      return result.rows[0];
    });

    res.status(201).json(booked);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This doctor is already booked for that time slot'
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Patient or doctor does not exist' });
    }
    next(err);
  }
});

router.patch('/:id/status', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const { role, doctor_id } = req.user;

    if (!['Scheduled', 'Completed', 'Cancelled', 'No-Show'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const current = await db.query(
      `SELECT status FROM appointment WHERE appt_id = $1`,
      [req.params.id]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    if (current.rows[0].status === 'Cancelled' && status !== 'Cancelled') {
      return res.status(409).json({
        error: 'A cancelled appointment cannot be reopened — book a new one'
      });
    }

    if (role === 'doctor') {
      const own = await db.query(
        `SELECT 1 FROM appointment WHERE appt_id = $1 AND doctor_id = $2`,
        [req.params.id, doctor_id]
      );
      if (own.rows.length === 0) {
        return res.status(403).json({
          error: 'You can only update your own appointments'
        });
      }
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE appointment SET status = $1 WHERE appt_id = $2 RETURNING *`,
        [status, req.params.id]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const check = await db.query(
      `SELECT patient_id, status FROM appointment WHERE appt_id = $1`,
      [req.params.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const { role, patient_id } = req.user;
    if (role === 'patient' && check.rows[0].patient_id !== patient_id) {
      return res.status(403).json({ error: 'You can only cancel your own appointment' });
    }
    if (!['admin', 'receptionist', 'patient'].includes(role)) {
      return res.status(403).json({ error: 'Not allowed to cancel appointments' });
    }
    if (check.rows[0].status !== 'Scheduled') {
      return res.status(409).json({
        error: `This appointment is already marked ${check.rows[0].status.toLowerCase()}`
      });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE appointment SET status = 'Cancelled' WHERE appt_id = $1 RETURNING *`,
        [req.params.id]
      );
    });
    res.json({ message: 'Appointment cancelled', appointment: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;