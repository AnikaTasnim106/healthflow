// ============================================================
//  routes/appointments.js
//  TODO — patients.js er pattern follow koro
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all appointments (patient + doctor naam shoho)
router.get('/', async (req, res, next) => {
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

// POST — notun appointment book
router.post('/', async (req, res, next) => {
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
    // 23505 = UNIQUE violation → uq_doc_slot fire korlo
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Ei doctor er oi slot ta already booked'
      });
    }
    next(err);
  }
});

// TODO: GET /:id                    — ek appointment + prescription
// TODO: PATCH /:id/status           — Completed / Cancelled mark kora
// TODO: GET /available-slots        — kon slot faka ache

// GET ek appointment + tar prescription (jodi thake)
router.get('/:id', async (req, res, next) => {
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

    const presc = await db.query(
      `SELECT presc_id, presc_date, diagnosis FROM prescription WHERE appt_id = $1`,
      [req.params.id]
    );

    res.json({ ...appt.rows[0], prescription: presc.rows[0] || null });
  } catch (err) { next(err); }
});

// PATCH — status change kora (Completed / Cancelled / No-Show)
router.patch('/:id/status', async (req, res, next) => {
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

// GET available slots — ekta doctor er ekta din kon kon slot faka
router.get('/available-slots', async (req, res, next) => {
  try {
    const { doctor_id, date } = req.query;

    if (!doctor_id || !date) {
      return res.status(400).json({ error: 'doctor_id and date required' });
    }

    // ei doctor er oi date e already booked slot gulo
    const booked = await db.query(
      `SELECT time_slot FROM appointment
       WHERE doctor_id = $1 AND appt_date = $2 AND status != 'Cancelled'`,
      [doctor_id, date]
    );

    res.json({
      doctor_id,
      date,
      booked_slots: booked.rows.map(r => r.time_slot)
    });
  } catch (err) { next(err); }
});

module.exports = router;
