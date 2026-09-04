// ============================================================
//  routes/doctors.js — FINAL (auth + appointment count + schedule + patients)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const nz = (v) => (v === '' || v === undefined ? null : v);


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


// ---------- GET ek doctor er weekly schedule (sob role) ----------
router.get('/:id/schedule', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT schedule_id, day_of_week, start_time, end_time,
              chamber_no, slot_duration, max_patients, is_active
       FROM doctor_schedule
       WHERE doctor_id = $1 AND is_active = TRUE
       ORDER BY start_time`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


// ---------- POST notun schedule slot add (shudhu admin) ----------
router.post('/:id/schedule', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { day_of_week, start_time, end_time, chamber_no, slot_duration, max_patients } = req.body;

    if (!day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'day_of_week, start_time, end_time required' });
    }

    const result = await db.query(
      `INSERT INTO doctor_schedule
         (doctor_id, day_of_week, start_time, end_time, chamber_no, slot_duration, max_patients)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.id, day_of_week, start_time, end_time,
        nz(chamber_no),
        slot_duration || 15,
        max_patients || 20
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ei doctor er oi din-e already ei start_time e schedule ache' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Invalid day_of_week ba end_time start_time er age' });
    }
    next(err);
  }
});


// ---------- GET /:id/patients — ei doctor ke jara dekhiyeche ----------
router.get('/:id/patients', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { role, doctor_id } = req.user;
    // doctor role hole shudhu nijer patient list dekhte parbe
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


// ---------- GET ek doctor er details (+ total appointment count) ----------
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.*, dep.dept_name,
              (SELECT COUNT(*) FROM appointment a WHERE a.doctor_id = d.doctor_id) AS total_appointments
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
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, specialization, phone, consult_fee, dept_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!dept_id) {
      return res.status(400).json({ error: 'Department is required' });
    }

    const result = await db.query(
      `INSERT INTO doctor (name, specialization, phone, consult_fee, dept_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        nz(specialization),
        nz(phone),
        consult_fee === '' || consult_fee == null ? 0 : Number(consult_fee),
        Number(dept_id)
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
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
        name.trim(),
        nz(specialization),
        nz(phone),
        consult_fee === '' || consult_fee == null ? 0 : Number(consult_fee),
        Number(dept_id),
        req.params.id
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
        error: 'Cannot delete — this doctor has appointments linked'
      });
    }
    next(err);
  }
});


module.exports = router;