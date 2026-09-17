const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requireOwnPatientRecord } = require('../middleware/auth');

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, doctor_id, patient_id } = req.user;

    const presc = await db.query(
      `SELECT pr.presc_id, pr.presc_date, pr.diagnosis,
              a.appt_id, a.doctor_id,
              p.patient_id, p.name AS patient_name,
              d.name AS doctor_name
       FROM prescription pr
       JOIN appointment a ON pr.appt_id    = a.appt_id
       JOIN patient p     ON a.patient_id  = p.patient_id
       JOIN doctor d      ON a.doctor_id   = d.doctor_id
       WHERE pr.presc_id = $1`,
      [id]
    );

    if (presc.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const row = presc.rows[0];

    if (role === 'doctor' && row.doctor_id !== doctor_id) {
      return res.status(403).json({
        error: 'You can only view prescriptions you wrote'
      });
    }

    if (role === 'patient' && row.patient_id !== patient_id) {
      return res.status(403).json({
        error: 'You can only view your own prescriptions'
      });
    }

    if (role === 'receptionist') {
      return res.status(403).json({
        error: 'Front desk staff cannot view clinical details'
      });
    }

    const medicines = await db.query(
      `SELECT m.med_id, m.name, pm.dosage, pm.frequency, pm.duration
       FROM presc_medicine pm
       JOIN medicine m ON pm.med_id = m.med_id
       WHERE pm.presc_id = $1`,
      [id]
    );

    res.json({ ...row, medicines: medicines.rows });
  } catch (err) { next(err); }
});


router.get('/patient/:patientId', requireAuth, requireOwnPatientRecord('patientId'), async (req, res, next) => {
  try {
    const { role, doctor_id } = req.user;
    const onlyMine = role === 'doctor' ? doctor_id : null;

    const result = await db.query(
      `SELECT pr.presc_id, pr.presc_date, pr.diagnosis,
              d.name AS doctor_name
       FROM prescription pr
       JOIN appointment a ON pr.appt_id  = a.appt_id
       JOIN doctor d      ON a.doctor_id = d.doctor_id
       WHERE a.patient_id = $1
         AND ($2::int IS NULL OR a.doctor_id = $2)
       ORDER BY pr.presc_date DESC`,
      [req.params.patientId, onlyMine]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.post('/', requireAuth, requireRole('admin', 'doctor'), async (req, res, next) => {
  try {
    const { appt_id, diagnosis, medicines } = req.body;
    const { role, doctor_id } = req.user;

    if (!appt_id || !medicines || medicines.length === 0) {
      return res.status(400).json({
        error: 'An appointment and at least one medicine are required'
      });
    }

    const appt = await db.query(
      `SELECT doctor_id, status FROM appointment WHERE appt_id = $1`,
      [appt_id]
    );

    if (appt.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (role === 'doctor' && appt.rows[0].doctor_id !== doctor_id) {
      return res.status(403).json({
        error: 'You can only write prescriptions for your own appointments'
      });
    }

    if (appt.rows[0].status === 'Cancelled') {
      return res.status(400).json({
        error: 'Cannot prescribe against a cancelled appointment'
      });
    }

    const prescription = await db.withTransaction(async (client) => {
      const pr = await client.query(
        `INSERT INTO prescription (appt_id, diagnosis)
         VALUES ($1, $2) RETURNING presc_id, presc_date, diagnosis`,
        [appt_id, diagnosis || null]
      );
      const prescId = pr.rows[0].presc_id;

      for (const med of medicines) {
        await client.query(
          `INSERT INTO presc_medicine (presc_id, med_id, dosage, frequency, duration)
           VALUES ($1, $2, $3, $4, $5)`,
          [prescId, med.med_id, med.dosage, med.frequency, med.duration]
        );
      }

      return pr.rows[0];
    });

    res.status(201).json(prescription);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This appointment already has a prescription'
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'One of the selected medicines does not exist' });
    }
    next(err);
  }
});


module.exports = router;