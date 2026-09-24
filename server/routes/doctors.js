const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const nz = (v) => (v === '' || v === undefined ? null : v);
function requireOwnSchedule(req, res, next) {
  const { role, doctor_id } = req.user;

  if (role === 'admin') return next();

  if (role === 'doctor') {
    if (doctor_id === parseInt(req.params.id, 10)) return next();
    return res.status(403).json({ error: 'You can only manage your own schedule' });
  }

  return res.status(403).json({ error: 'Only a doctor or an administrator can change a schedule' });
}
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.doctor_id, d.name, d.specialization, d.phone,
              d.consult_fee, dep.dept_name
       FROM doctor d
       JOIN department dep ON d.dept_id = dep.dept_id
       ORDER BY d.doctor_id`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});
router.get('/:id/schedule', requireAuth, async (req, res, next) => {
  try {
    const includeInactive = req.query.all === 'true';

    const result = await db.query(
      `SELECT schedule_id, doctor_id, day_of_week, start_time, end_time,
              chamber_no, slot_duration, max_patients, is_active
       FROM doctor_schedule
       WHERE doctor_id = $1
         AND ($2::boolean OR is_active = TRUE)
       ORDER BY
         CASE day_of_week
           WHEN 'Saturday'  THEN 1 WHEN 'Sunday'    THEN 2
           WHEN 'Monday'    THEN 3 WHEN 'Tuesday'   THEN 4
           WHEN 'Wednesday' THEN 5 WHEN 'Thursday'  THEN 6
           ELSE 7 END,
         start_time`,
      [req.params.id, includeInactive]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});
router.post('/:id/schedule', requireAuth, requireOwnSchedule, async (req, res, next) => {
  try {
    const { day_of_week, start_time, end_time, chamber_no,
            slot_duration, max_patients } = req.body;

    if (!day_of_week || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Day, start time and end time are required',
      });
    }

    if (end_time <= start_time) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const duration = Number(slot_duration) || 15;
    const cap = Number(max_patients) || 20;

    const created = await db.withTransaction(async (client) => {
      const clash = await client.query(
        `SELECT day_of_week, start_time, end_time
         FROM doctor_schedule
         WHERE doctor_id = $1
           AND day_of_week = $2
           AND is_active = TRUE
           AND ($3::time, $4::time) OVERLAPS (start_time, end_time)
         LIMIT 1`,
        [req.params.id, day_of_week, start_time, end_time]
      );

      if (clash.rows.length > 0) {
        const c = clash.rows[0];
        throw {
          status: 409,
          message: `This overlaps an existing ${c.day_of_week} slot, ${c.start_time} to ${c.end_time}`
        };
      }

      const fits = await client.query(
        `SELECT FLOOR(EXTRACT(EPOCH FROM ($2::time - $1::time)) / 60 / $3) AS slots`,
        [start_time, end_time, duration]
      );
      const slotCount = Number(fits.rows[0].slots);

      if (slotCount < 1) {
        throw {
          status: 400,
          message: `The window is shorter than one ${duration} minute slot`
        };
      }

      if (cap > slotCount) {
        throw {
          status: 400,
          message: `Only ${slotCount} slots of ${duration} minutes fit in that window`
        };
      }

      const result = await client.query(
        `INSERT INTO doctor_schedule
           (doctor_id, day_of_week, start_time, end_time,
            chamber_no, slot_duration, max_patients)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [req.params.id, day_of_week, start_time, end_time, nz(chamber_no), duration, cap]
      );
      return result.rows[0];
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'You already have a slot starting at that time on that day',
      });
    }
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'End time must be after start time',
      });
    }
    next(err);
  }
});
router.patch('/:id/schedule/:scheduleId', requireAuth, requireOwnSchedule, async (req, res, next) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be true or false' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE doctor_schedule
         SET is_active = $1
         WHERE schedule_id = $2 AND doctor_id = $3
         RETURNING *`,
        [is_active, req.params.scheduleId, req.params.id]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule slot not found' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});
router.delete('/:id/schedule/:scheduleId', requireAuth, requireOwnSchedule, async (req, res, next) => {
  try {
    const linked = await db.query(
      `SELECT COUNT(*) AS n FROM appointment
       WHERE schedule_id = $1 AND status = 'Scheduled'`,
      [req.params.scheduleId]
    );

    if (Number(linked.rows[0].n) > 0) {
      return res.status(409).json({
        error: `${linked.rows[0].n} upcoming appointment(s) use this slot — turn it off instead of removing it`
      });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `DELETE FROM doctor_schedule
         WHERE schedule_id = $1 AND doctor_id = $2
         RETURNING schedule_id`,
        [req.params.scheduleId, req.params.id]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule slot not found' });
    }
    res.json({ message: 'Slot removed', schedule_id: result.rows[0].schedule_id });
  } catch (err) { next(err); }
});
router.get('/:id/patients', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { role, doctor_id } = req.user;
    if (role === 'doctor' && doctor_id !== parseInt(req.params.id, 10)) {
      return res.status(403).json({ error: 'You can only view your own patients' });
    }

    const result = await db.query(
      `SELECT DISTINCT p.patient_id, p.name, p.phone, p.blood_group
       FROM appointment a
       JOIN patient p ON a.patient_id = p.patient_id
       WHERE a.doctor_id = $1
       ORDER BY p.name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.*, dep.dept_name,
              (SELECT COUNT(*) FROM appointment a WHERE a.doctor_id = d.doctor_id)
                AS total_appointments
       FROM doctor d
       JOIN department dep ON d.dept_id = dep.dept_id
       WHERE d.doctor_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, specialization, phone, consult_fee, dept_id,
            email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!dept_id) {
      return res.status(400).json({ error: 'Department is required' });
    }
    if ((email && !password) || (!email && password)) {
      return res.status(400).json({
        error: 'To create a login, give both an email and a password',
      });
    }
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const created = await db.withTransaction(async (client) => {
      const d = await client.query(
        `INSERT INTO doctor (name, specialization, phone, consult_fee, dept_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          name.trim(), nz(specialization), nz(phone),
          consult_fee === '' || consult_fee == null ? 0 : Number(consult_fee),
          Number(dept_id),
        ]
      );
      const doctor = d.rows[0];

      if (email && password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query(
          `INSERT INTO app_user (email, password_hash, full_name, role, doctor_id)
           VALUES ($1, $2, $3, 'doctor', $4)`,
          [email.toLowerCase().trim(), passwordHash, name.trim(), doctor.doctor_id]
        );
        doctor.login_email = email.toLowerCase().trim();
      }

      return doctor;
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint && err.constraint.includes('email')) {
        return res.status(409).json({ error: 'This email is already registered' });
      }
      return res.status(409).json({ error: 'This phone number is already registered' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Selected department does not exist' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Consultation fee cannot be negative' });
    }
    next(err);
  }
});
router.put('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, specialization, phone, consult_fee, dept_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE doctor
         SET name = $1, specialization = $2, phone = $3,
             consult_fee = $4, dept_id = $5
         WHERE doctor_id = $6
         RETURNING *`,
        [
          name.trim(), nz(specialization), nz(phone),
          consult_fee === '' || consult_fee == null ? 0 : Number(consult_fee),
          Number(dept_id), req.params.id,
        ]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This phone number is already registered' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Selected department does not exist' });
    }
    next(err);
  }
});
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.withTransaction(async (client) => {
      return client.query(
  `DELETE FROM doctor WHERE doctor_id = $1 RETURNING doctor_id`,
        [req.params.id]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json({ message: 'Doctor deleted', doctor_id: result.rows[0].doctor_id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete — this doctor has appointments linked',
      });
    }
    next(err);
  }
});

module.exports = router;