// ============================================================
//  routes/doctors.js
//  TODO — patients.js er pattern follow koro
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all doctors (department naam shoho)
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

// GET ek doctor er weekly schedule
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

// TODO: GET /:id  — ek doctor er details
// TODO: POST /    — notun doctor add
// TODO: PUT /:id  — update
// TODO: DELETE /:id

module.exports = router;
