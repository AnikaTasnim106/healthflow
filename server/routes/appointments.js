// ============================================================
//  routes/appointments.js — FINAL (auth + available-slots fix + DELETE)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ---------- GET all (admin, receptionist, doctor) ----------
router.get('/', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { date, status } = req.query;

    const result = await db.query(
      `SELECT a.appt_id, a.appt_date, a.time_slot, a.status,
              p.patient_id, p.name AS patient_name, p.phone,
              d.doctor_id, d.name AS doctor_name, dep.dept_name
       FROM appointment a
       JOIN patient p      ON a.patient_id = p.patient_id
       JOIN doctor d       ON a.doctor_id  = d.doctor_id
       JOIN department dep ON d.dept_id    = dep.dept_id
       WHERE ($1::date IS NULL OR a.appt_date = $1)
         AND ($2::text IS NULL OR a.status    = $2)
       ORDER BY a.appt_date DESC, a.time_slot`,
      [date || null, status || null]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET available-slots — ⚠️ /:id er AGE, sob role e dorkar (booking er age) ----------
// schedule er start_time/end_time/slot_duration theke shob slot generate kore,
// tarpor already-booked gulo bad diye dey (guide er section 5.1 er pattern)
router.get('/available-slots', requireAuth, async (req, res, next) => {
  try {
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      return res.status(400).json({ error: 'doctor_id and date required' });
    }

    const result = await db.query(
      `SELECT slot_time
       FROM doctor_schedule ds,
       generate_series(
           ds.start_time::time,
           ds.end_time::time - (ds.slot_duration || ' minutes')::interval,
           (ds.slot_duration || ' minutes')::interval
       ) AS slot_time
       WHERE ds.doctor_id = $1
         AND ds.day_of_week = TRIM(TO_CHAR($2::date, 'Day'))
         AND ds.is_active = TRUE
         AND slot_time NOT IN (
             SELECT time_slot FROM appointment
             WHERE doctor_id = $1 AND appt_date = $2 AND status != 'Cancelled'
         )
       ORDER BY slot_time`,
      [doctor_id, date]
    );

    res.json({
      doctor_id,
      date,
      available_slots: result.rows.map(r => r.slot_time)
    });
  } catch (err) { next(err); }
});

// ---------- GET ek appointment (ownership check) ----------
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

// ---------- POST book kora (admin, receptionist) ----------
router.post('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { patient_id, doctor_id, schedule_id, appt_date, time_slot } = req.body;

    const result = await db.query(
      `INSERT INTO appointment
         (patient_id, doctor_id, schedule_id, appt_date, time_slot)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patient_id, doctor_id, schedule_id, appt_date, time_slot]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Ei doctor er oi slot ta already booked'
      });
    }
    next(err);
  }
});

// ---------- PATCH status (admin, receptionist, doctor) ----------
router.patch('/:id/status', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { status } = req.body;

    const result = await db.query(
      `UPDATE appointment SET status = $1 WHERE appt_id = $2 RETURNING *`,
      [status, req.params.id]
    );

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

// ---------- DELETE (cancel) — admin, receptionist, ba nijer appointment hole patient nijeo ----------
// Soft-delete: row mucchi na, status 'Cancelled' kore dei (history rekhe dewar jonno)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const check = await db.query(`SELECT patient_id FROM appointment WHERE appt_id = $1`, [req.params.id]);
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

    const result = await db.query(
      `UPDATE appointment SET status = 'Cancelled' WHERE appt_id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ message: 'Appointment cancelled', appointment: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;