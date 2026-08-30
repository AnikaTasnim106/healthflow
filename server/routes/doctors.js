// ============================================================
//  routes/doctors.js
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// Form theke khali field ashle '' ashe — Postgres er NUMERIC/DATE
// column '' nite pare na, NULL lage.
const nz = (v) => (v === '' || v === undefined ? null : v);


// ---------- GET all (department naam shoho) ----------
router.get('/', async (req, res, next) => {
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


// ---------- GET ek doctor er weekly schedule ----------
// ⚠️ /:id/schedule specific, tai /:id er upore rakha
router.get('/:id/schedule', async (req, res, next) => {
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


// ---------- GET ek doctor er details ----------
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT d.*, dep.dept_name
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


// ---------- POST notun doctor ----------
router.post('/', async (req, res, next) => {
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
    // 23505 = UNIQUE violation (phone already ache)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This phone number is already registered' });
    }
    // 23503 = FK violation (dept_id database e nai)
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Selected department does not exist' });
    }
    // 23514 = CHECK violation (fee negative)
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Consultation fee cannot be negative' });
    }
    next(err);
  }
});


// ---------- PUT update ----------
router.put('/:id', async (req, res, next) => {
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


// ---------- DELETE ----------
router.delete('/:id', async (req, res, next) => {
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
    // 23503 = FK violation — appointment ache
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete — this doctor has appointments linked'
      });
    }
    next(err);
  }
});


module.exports = router;