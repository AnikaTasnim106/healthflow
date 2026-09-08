

const jwt = require('jsonwebtoken');
const db = require('../db');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Login required' });
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const session = await db.query(
      `SELECT s.session_id, s.expires_at,
              u.user_id, u.email, u.role, u.full_name AS name,
              u.patient_id, u.doctor_id, u.is_active
       FROM auth_sessions s
       JOIN app_user u ON s.user_id = u.user_id
       WHERE s.session_id = $1`,
      [payload.session_id]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Session expired or logged out' });
    }

    if (new Date(session.rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    if (!session.rows[0].is_active) {
      return res.status(401).json({ error: 'Account is no longer active' });
    }

    req.user = session.rows[0];
    req.sessionId = payload.session_id;
    next();
  } catch (err) {
    next(err);
  }
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not allowed to access this' });
    }
    next();
  };
}


function requireOwnPatientRecord(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Login required' });
    }

    const { role, patient_id } = req.user;

    if (role === 'admin' || role === 'receptionist' || role === 'doctor') {
      return next();
    }

    if (role === 'patient') {
      const requestedId = parseInt(req.params[paramName], 10);
      if (Number.isNaN(requestedId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      if (patient_id === requestedId) {
        return next();
      }
      return res.status(403).json({ error: 'You can only access your own data' });
    }

    return res.status(403).json({ error: 'Not allowed' });
  };
}

module.exports = { requireAuth, requireRole, requireOwnPatientRecord };