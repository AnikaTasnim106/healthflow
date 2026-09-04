// ============================================================
//  routes/prescriptions.js
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requireOwnPatientRecord } = require('../middleware/auth');

// ---------- GET ek prescription (admin, receptionist, doctor) ----------
router.get('/:id', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const presc = await db.query(
      `SELECT pr.presc_id, pr.presc_date, pr.diagnosis,
              a.appt_id, p.patient_id, p.name AS patient_name,
              d.name AS doctor_name
       FROM prescription pr
       JOIN appointment a ON pr.appt_id = a.appt_id
       JOIN patient p     ON a.patient_id = p.patient_id
       JOIN doctor d      ON a.doctor_id  = d.doctor_id
       WHERE pr.presc_id = $1`,
      [id]
    );

    if (presc.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const medicines = await db.query(
      `SELECT m.med_id, m.name, pm.dosage, pm.frequency, pm.duration
       FROM presc_medicine pm
       JOIN medicine m ON pm.med_id = m.med_id
       WHERE pm.presc_id = $1`,
      [id]
    );

    res.json({ ...presc.rows[0], medicines: medicines.rows });
  } catch (err) { next(err); }
});


// ---------- GET /patient/:patientId (ownership check) ----------
router.get('/patient/:patientId', requireAuth, requireOwnPatientRecord('patientId'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT pr.presc_id, pr.presc_date, pr.diagnosis,
              d.name AS doctor_name
       FROM prescription pr
       JOIN appointment a ON pr.appt_id = a.appt_id
       JOIN doctor d      ON a.doctor_id = d.doctor_id
       WHERE a.patient_id = $1
       ORDER BY pr.presc_date DESC`,
      [req.params.patientId]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


// ---------- POST notun prescription (shudhu doctor, admin) ----------
router.post('/', requireAuth, requireRole('admin', 'doctor'), async (req, res, next) => {
  try {
    const { appt_id, diagnosis, medicines } = req.body;

    if (!appt_id || !medicines || medicines.length === 0) {
      return res.status(400).json({
        error: 'appt_id and at least one medicine required'
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
        error: 'Ei appointment er jonno already ekta prescription ache'
      });
    }
    next(err);
  }
});

module.exports = router;