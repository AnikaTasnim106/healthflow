// ============================================================
//  routes/admissions.js
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ---------- GET all (admin, receptionist, doctor) ----------
router.get('/', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ad.admission_id, ad.admit_date, ad.discharge_date,
              p.patient_id, p.name AS patient_name,
              r.room_no, r.room_type, r.daily_charge
       FROM admission ad
       JOIN patient p ON ad.patient_id = p.patient_id
       JOIN room r    ON ad.room_no    = r.room_no
       ORDER BY ad.admit_date DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET available rooms (admin, receptionist) ----------
router.get('/available-rooms', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT room_no, room_type, daily_charge
       FROM room
       WHERE status = 'Available'
       ORDER BY room_type, daily_charge`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET ek admission (ownership check) ----------
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ad.*, p.name AS patient_name, p.phone,
              r.room_type, r.daily_charge
       FROM admission ad
       JOIN patient p ON ad.patient_id = p.patient_id
       JOIN room r    ON ad.room_no    = r.room_no
       WHERE ad.admission_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admission not found' });
    }

    const { role, patient_id } = req.user;
    if (role === 'patient' && result.rows[0].patient_id !== patient_id) {
      return res.status(403).json({ error: 'You can only access your own admission' });
    }

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

// ---------- POST admit kora (admin, receptionist) — TRANSACTION ----------
router.post('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { patient_id, room_no, admit_date } = req.body;

    if (!patient_id || !room_no) {
      return res.status(400).json({ error: 'patient_id and room_no required' });
    }

    const admission = await db.withTransaction(async (client) => {
      const roomCheck = await client.query(
        `SELECT status FROM room WHERE room_no = $1`,
        [room_no]
      );

      if (roomCheck.rows.length === 0) {
        throw { status: 404, message: 'Room not found' };
      }
      if (roomCheck.rows[0].status !== 'Available') {
        throw { status: 409, message: 'Room is not available' };
      }

      const result = await client.query(
        `INSERT INTO admission (patient_id, room_no, admit_date)
         VALUES ($1, $2, COALESCE($3, CURRENT_DATE))
         RETURNING *`,
        [patient_id, room_no, admit_date || null]
      );

      await client.query(
        `UPDATE room SET status = 'Occupied' WHERE room_no = $1`,
        [room_no]
      );

      return result.rows[0];
    });

    res.status(201).json(admission);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ---------- PATCH discharge (admin, receptionist) ----------
router.patch('/:id/discharge', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { discharge_date } = req.body;

    const updated = await db.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE admission
         SET discharge_date = COALESCE($1, CURRENT_DATE)
         WHERE admission_id = $2
         RETURNING *`,
        [discharge_date || null, id]
      );

      if (result.rows.length === 0) {
        throw { status: 404, message: 'Admission not found' };
      }

      const roomNo = result.rows[0].room_no;

      await client.query(
        `UPDATE room SET status = 'Available' WHERE room_no = $1`,
        [roomNo]
      );

      return result.rows[0];
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;