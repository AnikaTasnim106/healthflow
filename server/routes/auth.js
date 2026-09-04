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
//
// ⚠️ role ekhane client theke NEWA HOY NA.
//    Self-registration always 'patient' e hoy — hardcode kora.
//    Keu {"role":"admin"} pathaleo kaj korbe na.
//
//    Guideline 3.1: "The role must be stored in the database and
//    read from there at login; it must not be sent by the client."
//
//    Staff account (admin / receptionist / doctor) admin banabe,
//    ba direct SQL diye insert kora hoy.
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, patient_id } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // password hash kora — bcrypt nijei per-user random salt generate kore
    // ar seta hash er bhitorei rakhe, tai alada salt column lage na
    const passwordHash = await bcrypt.hash(password, 10);

    // patient role er jonno patient_id obosshoi lagbe (chk_role_link
    // constraint). Na dile notun ekta patient record banai.
    const created = await db.withTransaction(async (client) => {
      let linkedPatientId = patient_id || null;

      if (!linkedPatientId) {
        const p = await client.query(
          `INSERT INTO patient (name) VALUES ($1) RETURNING patient_id`,
          [name]
        );
        linkedPatientId = p.rows[0].patient_id;
      }

      const u = await client.query(
        `INSERT INTO app_user (email, password_hash, full_name, role, patient_id)
         VALUES ($1, $2, $3, 'patient', $4)
         RETURNING user_id, email, full_name AS name, role, patient_id`,
        [email, passwordHash, name, linkedPatientId]
      );
      return u.rows[0];
    });

    res.status(201).json({ message: 'Registered successfully', user: created });
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
      `SELECT user_id, email, password_hash, full_name, role,
              patient_id, doctor_id, is_active
       FROM app_user WHERE email = $1`,
      [email]
    );

    // ⚠️ email nai ar password bhul — DUITAR jonno EKI message.
    // Alada message dile keu bujhe felbe kon email registered ache.
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'This account is not active' });
    }

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

    // role token e boshe, kintu seta DATABASE THEKE pora hoyeche —
    // client kokhono nijer role thik korte pare na
    const token = jwt.sign(
      { session_id: sessionId, user_id: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: TOKEN_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        user_id:    user.user_id,
        email:      user.email,
        name:       user.full_name,
        role:       user.role,
        patient_id: user.patient_id,
        doctor_id:  user.doctor_id
      }
    });
  } catch (err) { next(err); }
});


// ---------- POST /logout ----------
// requireAuth diye token check kora hoy, tarpor sei session DB theke delete
// kore dei — tokhon theke oi token ar kaj korbe na (ei jonnoi eta "sotti" logout)
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM auth_sessions WHERE session_id = $1`,
      [req.sessionId]
    );
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});


// ---------- GET /me — ekhon je login kore ache tar info ----------
// Page refresh er por frontend ei ta dake — token ekhono valid kina jante
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      user_id:    req.user.user_id,
      email:      req.user.email,
      name:       req.user.name,
      role:       req.user.role,
      patient_id: req.user.patient_id,
      doctor_id:  req.user.doctor_id
    }
  });
});


module.exports = router;