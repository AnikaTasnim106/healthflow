

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const TOKEN_EXPIRES_IN = '7d';

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, patient_id } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    
    const passwordHash = await bcrypt.hash(password, 10);

    
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
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
});


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


router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await db.query(
      `DELETE FROM auth_sessions WHERE session_id = $1`,
      [req.sessionId]
    );
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});


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