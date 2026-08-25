const express = require('express');
const router = express.Router();
const db = require('../db');


router.get('/catalog', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT test_id, test_name, cost FROM lab_test ORDER BY test_name`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.get('/pending', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT pt.patient_id, p.name AS patient_name,
              pt.test_id, lt.test_name, pt.test_date,
              d.name AS suggested_by
       FROM patient_test pt
       JOIN patient p   ON pt.patient_id = p.patient_id
       JOIN lab_test lt ON pt.test_id    = lt.test_id
       LEFT JOIN doctor d ON pt.doctor_id = d.doctor_id
       WHERE pt.result IS NULL
       ORDER BY pt.test_date`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.get('/patient/:patientId', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT pt.test_id, lt.test_name, lt.cost,
              pt.test_date, pt.result, d.name AS suggested_by
       FROM patient_test pt
       JOIN lab_test lt ON pt.test_id = lt.test_id
       LEFT JOIN doctor d ON pt.doctor_id = d.doctor_id
       WHERE pt.patient_id = $1
       ORDER BY pt.test_date DESC`,
      [req.params.patientId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.post('/', async (req, res, next) => {
  try {
    const { patient_id, test_id, doctor_id, test_date } = req.body;

    if (!patient_id || !test_id) {
      return res.status(400).json({ error: 'patient_id and test_id required' });
    }

    const result = await db.query(
      `INSERT INTO patient_test (patient_id, test_id, doctor_id, test_date)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE))
       RETURNING *`,
      [patient_id, test_id, doctor_id || null, test_date || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Ei patient er ei test ta oi diner jonno already assign kora ache'
      });
    }
    next(err);
  }
});


router.patch('/:patientId/:testId/:testDate', async (req, res, next) => {
  try {
    const { patientId, testId, testDate } = req.params;
    const { result: testResult } = req.body;

    const result = await db.query(
      `UPDATE patient_test
       SET result = $1
       WHERE patient_id = $2 AND test_id = $3 AND test_date = $4
       RETURNING *`,
      [testResult, patientId, testId, testDate]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;