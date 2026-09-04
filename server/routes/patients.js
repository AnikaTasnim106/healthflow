
const express = require('express');
const router = express.Router();
const db = require('../db');

const nz = (v) => (v === '' || v === undefined ? null : v);


router.get('/', async (req, res, next) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT patient_id, name, dob, gender, phone, address, blood_group
       FROM patient
       WHERE name ILIKE $1 OR phone ILIKE $1
       ORDER BY patient_id
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});


router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const patient = await db.query(
      `SELECT * FROM patient WHERE patient_id = $1`, [id]
    );

    if (patient.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const appointments = await db.query(
      `SELECT a.appt_id, a.appt_date, a.time_slot, a.status,
              d.name AS doctor_name, dep.dept_name
       FROM appointment a
       JOIN doctor d       ON a.doctor_id = d.doctor_id
       JOIN department dep ON d.dept_id   = dep.dept_id
       WHERE a.patient_id = $1
       ORDER BY a.appt_date DESC`,
      [id]
    );

    res.json({
      ...patient.rows[0],
      appointments: appointments.rows
    });
  } catch (err) {
    next(err);
  }
});


router.post('/', async (req, res, next) => {
  try {
    const { name, dob, gender, phone, address, blood_group } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
      `INSERT INTO patient (name, dob, gender, phone, address, blood_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name.trim(),
        nz(dob),           
        nz(gender),
        nz(phone),
        nz(address),
        nz(blood_group)
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'Invalid value — check gender or blood group'
      });
    }
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ error: 'Invalid date of birth' });
    }
    next(err);
  }
});


router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, dob, gender, phone, address, blood_group } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
      `UPDATE patient
       SET name = $1, dob = $2, gender = $3,
           phone = $4, address = $5, blood_group = $6
       WHERE patient_id = $7
       RETURNING *`,
      [
        name.trim(),
        nz(dob),
        nz(gender),
        nz(phone),
        nz(address),
        nz(blood_group),
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'Invalid value — check gender or blood group'
      });
    }
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ error: 'Invalid date of birth' });
    }
    next(err);
  }
});


router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM patient WHERE patient_id = $1 RETURNING patient_id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ message: 'Patient deleted', patient_id: result.rows[0].patient_id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete — this patient has bills or admissions linked'
      });
    }
    next(err);
  }
});


module.exports = router;