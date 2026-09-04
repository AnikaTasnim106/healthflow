// ============================================================
//  routes/patients.js — auth middleware lagano hoyeche
//  Ei pattern ta baki shob route e (doctors, appointments, billing,
//  admissions, prescriptions, labtests) copy koro
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole, requireOwnPatientRecord } = require('../middleware/auth');

// Form theke khali field ashle '' (khali string) ashe.
// Postgres er DATE column '' nite pare na — NULL lage.
const nz = (v) => (v === '' || v === undefined ? null : v);

const STAFF = ['admin', 'receptionist', 'doctor'];


// ---------- GET all (admin, receptionist, doctor dekhte pare — patient na) ----------
router.get('/', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
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
  } catch (err) { next(err); }
});


// ---------- GET one (+ appointment history) ----------
// requireOwnPatientRecord: admin/receptionist/doctor shobar data dekhte pare,
// kintu patient shudhu NIJER id (URL er :id) match korle dekhte parbe —
// eta e object-level ownership check
router.get('/:id', requireAuth, requireOwnPatientRecord('id'), async (req, res, next) => {
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
  } catch (err) { next(err); }
});


// ---------- POST create (shudhu admin/receptionist notun patient add korte pare) ----------
router.post('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { name, dob, gender, phone, address, blood_group } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.query(
      `INSERT INTO patient (name, dob, gender, phone, address, blood_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), nz(dob), nz(gender), nz(phone), nz(address), nz(blood_group)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Invalid value — check gender or blood group' });
    }
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ error: 'Invalid date of birth' });
    }
    next(err);
  }
});


// ---------- PUT update — FULL record (shudhu staff) ----------
//
// ⚠️ FIELD-LEVEL AUTHORIZATION
//
// Ashol hospital e patient nijer name, DOB ba blood group palte pare na —
// oigulo identity ar clinical data, front desk e verify kore palte hoy.
// Patient shudhu contact details palte pare (nichey PATCH /:id/contact).
//
// Tai ei route ta requireRole('admin','receptionist') —
// requireOwnPatientRecord na. Patient ekhane 403 pabe, tar
// nijer record holeo.
router.put('/:id', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
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
      [name.trim(), nz(dob), nz(gender), nz(phone), nz(address), nz(blood_group), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Invalid value — check gender or blood group' });
    }
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ error: 'Invalid date of birth' });
    }
    next(err);
  }
});


// ---------- PATCH contact details ----------
//
// Patient nijer phone ar address palte pare. Staff-o pare.
//
// ⚠️ Ei route ta SHUDHU phone ar address er UPDATE likhe.
//    Keu body te blood_group ba name pathaleo seta IGNORE hoy —
//    query te oi column gulo nei-i. Ei ta e asol enforcement;
//    frontend e field disable kore rakha shudhu presentation.
//
// requireOwnPatientRecord: patient shudhu nijer id te parbe,
// onner id dile 403.
router.patch('/:id/contact', requireAuth, requireOwnPatientRecord('id'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { phone, address } = req.body;

    const result = await db.query(
      `UPDATE patient
       SET phone = $1, address = $2
       WHERE patient_id = $3
       RETURNING *`,
      [nz(phone), nz(address), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});


// ---------- DELETE (shudhu admin) ----------
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
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