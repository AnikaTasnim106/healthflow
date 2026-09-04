// ============================================================
//  routes/auth.js
// ============================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const TOKEN_EXPIRES_IN = '7d';

// ---------- POST /register ----------
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role, patient_id, doctor_id } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, role required' });
    }

    const validRoles = ['admin', 'receptionist', 'doctor', 'patient'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // password hash kora — bcrypt nijei per-user random salt generate kore
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO app_user (email, password_hash, name, role, patient_id, doctor_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, name, role`,
      [email, passwordHash, name, role, patient_id || null, doctor_id || null]
    );

    res.status(201).json({ message: 'Registered successfully', user: result.rows[0] });
  } catch (err) {
    // 23505 = UNIQUE violation — email already ache
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
});

// ---------- POST /login ----------
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const userResult = await db.query(
      `SELECT user_id, email, password_hash, full_name, role, patient_id, doctor_id
       FROM app_user WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // notun session banano (logout er somoy ei row delete hobe)
    const sessionResult = await db.query(
      `INSERT INTO auth_sessions (user_id) VALUES ($1) RETURNING session_id`,
      [user.user_id]
    );
    const sessionId = sessionResult.rows[0].session_id;

    const token = jwt.sign(
      { session_id: sessionId, user_id: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        patient_id: user.patient_id,
        doctor_id: user.doctor_id
      }
    });
  } catch (err) { next(err); }
});

// ---------- POST /logout ----------
// requireAuth diye token check kora hoy, tarpor sei session DB theke delete
// kore dei — tokhon theke oi token ar kaj korbe na (ei jonnoi eta "sotti" logout)
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await db.query(`DELETE FROM auth_sessions WHERE session_id = $1`, [req.sessionId]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

// ---------- GET /me — ekhon je login kore ache tar info ----------
router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;