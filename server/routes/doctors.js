// ============================================================
//  routes/doctors.js — FINAL (auth + schedule self-management)
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const nz = (v) => (v === '' || v === undefined ? null : v);

// ------------------------------------------------------------
//  requireOwnSchedule — OBJECT-LEVEL OWNERSHIP for doctors
//
//  Admin je kono doctor er schedule palte pare.
//  Doctor SHUDHU nijer ta — URL er :id tar nijer doctor_id
//  na hole 403.
//
//  Doctor er nijer doctor_id token theke ashe (login er somoy
//  DB theke pora), client theke na. Tai URL palte onner
//  schedule e hat dewa jabe na.
// ------------------------------------------------------------
function requireOwnSchedule(req, res, next) {
  const { role, doctor_id } = req.user;

  if (role === 'admin') return next();

  if (role === 'doctor') {
    if (doctor_id === parseInt(req.params.id, 10)) return next();
    return res.status(403).json({ error: 'You can only manage your own schedule' });
  }

  return res.status(403).json({ error: 'Only a doctor or an administrator can change a schedule' });
}


// ---------- GET all (sob role) ----------
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


// ---------- GET schedule ----------
// ?all=true dile inactive slot gulo o ashbe (doctor nijer page e
// dekhbe, kintu appointment booking e shudhu active gulo lagbe)
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


// ---------- POST notun slot (admin, ba doctor nijer ta) ----------
router.post('/:id/schedule', requireAuth, requireOwnSchedule, async (req, res, next) => {
  try {
    const { day_of_week, start_time, end_time, chamber_no,
            slot_duration, max_patients } = req.body;

    if (!day_of_week || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Day, start time and end time are required',
      });
    }

    const result = await db.query(
      `INSERT INTO doctor_schedule
         (doctor_id, day_of_week, start_time, end_time,
          chamber_no, slot_duration, max_patients)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.id, day_of_week, start_time, end_time,
        nz(chamber_no),
        slot_duration || 15,
        max_patients || 20,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    // 23505 = uq_doc_day_slot — eki din eki start_time e already ache
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'You already have a slot starting at that time on that day',
      });
    }
    // 23514 = chk_sched_time — end_time start_time er age
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'End time must be after start time',
      });
    }
    next(err);
  }
});


// ---------- PATCH slot on/off (admin, ba doctor nijer ta) ----------
// Chhuti nile slot ta delete na kore off kore rakha jay —
// purano appointment gulo schedule_id ference rakhe.
router.patch('/:id/schedule/:scheduleId', requireAuth, requireOwnSchedule, async (req, res, next) => {
  try {
    const { is_active } = req.body;

    const result = await db.query(
      `UPDATE doctor_schedule
       SET is_active = $1
       WHERE schedule_id = $2 AND doctor_id = $3
       RETURNING *`,
      [is_active === true, req.params.scheduleId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule slot not found' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});


// ---------- DELETE slot (admin, ba doctor nijer ta) ----------
router.delete('/:id/schedule/:scheduleId', requireAuth, requireOwnSchedule, async (req, res, next) => {
  try {
    // doctor_id o WHERE e ache — keu onno doctor er schedule_id
    // pathaleo mile na, tai delete hobe na
    const result = await db.query(
      `DELETE FROM doctor_schedule
       WHERE schedule_id = $1 AND doctor_id = $2
       RETURNING schedule_id`,
      [req.params.scheduleId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule slot not found' });
    }
    res.json({ message: 'Slot removed', schedule_id: result.rows[0].schedule_id });
  } catch (err) { next(err); }
});


// ---------- GET /:id/patients — ei doctor ke jara dekhiyeche ----------
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


// ---------- GET ek doctor er details ----------
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


// ---------- POST notun doctor (shudhu admin) ----------
//
// email + password dile ekta LOGIN ACCOUNT o banano hoy.
//
// ⚠️ role ekhane 'doctor' HARDCODE kora — client theke ashe na.
//    Ar ei route ta requireRole('admin'), tai shudhu admin-i
//    staff account banate pare. Self-registration (auth.js er
//    /register) always 'patient' e hoy.
//
//    Doctor row ar app_user row EK TRANSACTION e — ekta fail
//    korle duitai rollback. Nahole doctor thakto kintu login
//    account nai (ba ulta) emon obostha hoto.
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
    // email dile password o lagbe, ar ulta
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
      // phone ba email — duitatei UNIQUE ache
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


// ---------- PUT update (shudhu admin) ----------
router.put('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, specialization, phone, consult_fee, dept_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
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


// ---------- DELETE (shudhu admin) ----------
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM doctor WHERE doctor_id = $1 RETURNING doctor_id`,
      [req.params.id]
    );

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