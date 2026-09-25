const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole, requirePatientAccess } = require('../middleware/auth');

const nz = (v) => (v === '' || v === undefined ? null : v);

router.get('/', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;
    const { role, doctor_id } = req.user;
    const onlyMine = role === 'doctor' ? doctor_id : null;

    const result = await db.query(
      `SELECT p.patient_id, p.name, p.dob, p.gender,
              p.phone, p.address, p.blood_group,
              u.email AS login_email
       FROM patient p
       LEFT JOIN app_user u ON u.patient_id = p.patient_id
       WHERE (p.name ILIKE $1 OR p.phone ILIKE $1)
         AND ($4::int IS NULL OR EXISTS (
               SELECT 1 FROM appointment a
               WHERE a.patient_id = p.patient_id
                 AND a.doctor_id  = $4
             ))
       ORDER BY p.patient_id
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset, onlyMine]
    );

    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id/login', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT user_id, email, is_active FROM app_user WHERE patient_id = $1`,
      [req.params.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, requirePatientAccess('id'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, doctor_id } = req.user;

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
         AND ($2::int IS NULL OR a.doctor_id = $2)
       ORDER BY a.appt_date DESC`,
      [id, role === 'doctor' ? doctor_id : null]
    );

    res.json({
      ...patient.rows[0],
      appointments: appointments.rows
    });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { name, dob, gender, phone, address, blood_group } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `INSERT INTO patient (name, dob, gender, phone, address, blood_group)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name.trim(), nz(dob), nz(gender), nz(phone), nz(address), nz(blood_group)]
      );
    });

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

router.put('/:id', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, dob, gender, phone, address, blood_group } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE patient
         SET name = $1, dob = $2, gender = $3,
             phone = $4, address = $5, blood_group = $6
         WHERE patient_id = $7
         RETURNING *`,
        [name.trim(), nz(dob), nz(gender), nz(phone), nz(address), nz(blood_group), id]
      );
    });

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

router.patch('/:id/contact', requireAuth, requirePatientAccess('id'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { phone, address } = req.body;

    if (req.user.role === 'doctor') {
      return res.status(403).json({ error: 'Doctors cannot change contact details' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE patient
         SET phone = $1, address = $2
         WHERE patient_id = $3
         RETURNING *`,
        [nz(phone), nz(address), id]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.post('/:id/login', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const created = await db.withTransaction(async (client) => {
      const p = await client.query(
        `SELECT name FROM patient WHERE patient_id = $1`,
        [id]
      );
      if (p.rows.length === 0) {
        throw { status: 404, message: 'Patient not found' };
      }

      const already = await client.query(
        `SELECT email FROM app_user WHERE patient_id = $1`,
        [id]
      );
      if (already.rows.length > 0) {
        throw {
          status: 409,
          message: `This patient already signs in as ${already.rows[0].email}`
        };
      }

      const hash = await bcrypt.hash(password, 10);

      const u = await client.query(
        `INSERT INTO app_user (email, password_hash, full_name, role, patient_id)
         VALUES ($1, $2, $3, 'patient', $4)
         RETURNING user_id, email, full_name AS name, role, patient_id`,
        [email.toLowerCase().trim(), hash, p.rows[0].name, id]
      );
      return u.rows[0];
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    next(err);
  }
});

router.post('/:id/login', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const created = await db.withTransaction(async (client) => {
      const patient = await client.query(
        `SELECT name FROM patient WHERE patient_id = $1 FOR UPDATE`,
        [id]
      );
      if (patient.rows.length === 0) {
        throw { status: 404, message: 'Patient not found' };
      }

      const already = await client.query(
        `SELECT email FROM app_user WHERE patient_id = $1`,
        [id]
      );
      if (already.rows.length > 0) {
        throw {
          status: 409,
          message: `This patient already has a login (${already.rows[0].email})`
        };
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const u = await client.query(
        `INSERT INTO app_user (email, password_hash, full_name, role, patient_id)
         VALUES ($1, $2, $3, 'patient', $4)
         RETURNING user_id, email, full_name AS name, role, patient_id`,
        [email.toLowerCase().trim(), passwordHash, patient.rows[0].name, id]
      );
      return u.rows[0];
    });

    res.status(201).json(created);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    next(err);
  }
});


router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.withTransaction(async (client) => {
      return client.query(
  `DELETE FROM patient WHERE patient_id = $1 RETURNING patient_id`,
        [req.params.id]
      );
    });

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