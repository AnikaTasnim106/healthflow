const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requirePatientAccess } = require('../middleware/auth');

router.get('/catalog', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT test_id, test_name, cost FROM lab_test ORDER BY test_name`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.get('/pending', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { role, doctor_id } = req.user;
    const onlyMine = role === 'doctor' ? doctor_id : null;

    const result = await db.query(
      `SELECT pt.patient_id, p.name AS patient_name,
              pt.test_id, lt.test_name, pt.test_date,
              pt.doctor_id, d.name AS suggested_by
       FROM patient_test pt
       JOIN patient p     ON pt.patient_id = p.patient_id
       JOIN lab_test lt   ON pt.test_id    = lt.test_id
       LEFT JOIN doctor d ON pt.doctor_id  = d.doctor_id
       WHERE pt.result IS NULL
         AND ($1::int IS NULL OR pt.doctor_id = $1)
       ORDER BY pt.test_date`,
      [onlyMine]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.get('/patient/:patientId', requireAuth, requirePatientAccess('patientId'), async (req, res, next) => {
  try {
    const { role, doctor_id } = req.user;
    const onlyMine = role === 'doctor' ? doctor_id : null;

    const result = await db.query(
      `SELECT pt.test_id, lt.test_name, lt.cost,
              pt.test_date, pt.result, d.name AS suggested_by
       FROM patient_test pt
       JOIN lab_test lt   ON pt.test_id   = lt.test_id
       LEFT JOIN doctor d ON pt.doctor_id = d.doctor_id
       WHERE pt.patient_id = $1
         AND ($2::int IS NULL OR pt.doctor_id = $2)
       ORDER BY pt.test_date DESC`,
      [req.params.patientId, onlyMine]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.post('/', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { patient_id, test_id, test_date } = req.body;
    const { role, doctor_id } = req.user;

    if (!patient_id || !test_id) {
      return res.status(400).json({ error: 'A patient and a test are required' });
    }

    if (test_date) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const wanted = new Date(test_date); wanted.setHours(0, 0, 0, 0);
      if (wanted > today) {
        return res.status(400).json({
          error: 'A test cannot be dated in the future'
        });
      }
    }

    const suggestedBy = role === 'doctor'
      ? doctor_id
      : (req.body.doctor_id || null);

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `INSERT INTO patient_test (patient_id, test_id, doctor_id, test_date)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE))
         RETURNING *`,
        [patient_id, test_id, suggestedBy, test_date || null]
      );
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This test is already ordered for that patient on that date'
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Patient, test or doctor does not exist' });
    }
    next(err);
  }
});


router.patch('/:patientId/:testId/:testDate', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { patientId, testId, testDate } = req.params;
    const { result: testResult } = req.body;
    const { role, doctor_id } = req.user;

    if (!testResult || !String(testResult).trim()) {
      return res.status(400).json({ error: 'A result is required' });
    }

    const existing = await db.query(
      `SELECT doctor_id, result FROM patient_test
       WHERE patient_id = $1 AND test_id = $2 AND test_date = $3`,
      [patientId, testId, testDate]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Test record not found' });
    }

    if (role === 'doctor' && existing.rows[0].doctor_id !== doctor_id) {
      return res.status(403).json({
        error: 'You can only record results for tests you ordered'
      });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE patient_test
         SET result = $1
         WHERE patient_id = $2 AND test_id = $3 AND test_date = $4
         RETURNING *`,
        [String(testResult).trim(), patientId, testId, testDate]
      );
    });

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});


module.exports = router;