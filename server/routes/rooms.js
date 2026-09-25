const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/summary', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT room_type,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'Available')   AS available,
              COUNT(*) FILTER (WHERE status = 'Occupied')    AS occupied,
              COUNT(*) FILTER (WHERE status = 'Maintenance') AS maintenance,
              MIN(daily_charge) AS min_charge,
              MAX(daily_charge) AS max_charge
       FROM room
       GROUP BY room_type
       ORDER BY MIN(daily_charge)`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.get('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { status, type } = req.query;

    const result = await db.query(
      `SELECT r.room_no, r.room_type, r.daily_charge, r.status,
              a.admission_id, a.admit_date,
              p.patient_id, p.name AS patient_name
       FROM room r
       LEFT JOIN admission a ON a.room_no = r.room_no
                            AND a.discharge_date IS NULL
       LEFT JOIN patient p   ON a.patient_id = p.patient_id
       WHERE ($1::text IS NULL OR r.status    = $1)
         AND ($2::text IS NULL OR r.room_type = $2)
       ORDER BY r.room_type, r.room_no`,
      [status || null, type || null]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { room_no, room_type, daily_charge } = req.body;

    if (!room_no || !room_no.trim()) {
      return res.status(400).json({ error: 'Room number is required' });
    }
    if (!room_type) {
      return res.status(400).json({ error: 'Room type is required' });
    }
    if (!daily_charge || Number(daily_charge) <= 0) {
      return res.status(400).json({ error: 'Daily charge must be more than zero' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `INSERT INTO room (room_no, room_type, daily_charge)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [room_no.trim(), room_type, Number(daily_charge)]
      );
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A room with that number already exists' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Invalid room type or daily charge' });
    }
    next(err);
  }
});


router.put('/:roomNo', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { room_type, daily_charge } = req.body;

    if (!daily_charge || Number(daily_charge) <= 0) {
      return res.status(400).json({ error: 'Daily charge must be more than zero' });
    }

    const result = await db.withTransaction(async (client) => {
      return client.query(
  `UPDATE room
         SET room_type = $1, daily_charge = $2
         WHERE room_no = $3
         RETURNING *`,
        [room_type, Number(daily_charge), req.params.roomNo]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Invalid room type or daily charge' });
    }
    next(err);
  }
});


router.patch('/:roomNo/status', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const { roomNo } = req.params;

    if (!['Available', 'Maintenance'].includes(status)) {
      return res.status(400).json({
        error: 'A room can only be set to Available or Maintenance by hand'
      });
    }

    const updated = await db.withTransaction(async (client) => {
      const current = await client.query(
        `SELECT status FROM room WHERE room_no = $1 FOR UPDATE`,
        [roomNo]
      );

      if (current.rows.length === 0) {
        throw { status: 404, message: 'Room not found' };
      }

      const active = await client.query(
        `SELECT 1 FROM admission
         WHERE room_no = $1 AND discharge_date IS NULL
         LIMIT 1`,
        [roomNo]
      );

      if (active.rows.length > 0) {
        throw {
          status: 409,
          message: 'A patient is still in this room — discharge them first'
        };
      }

      const result = await client.query(
        `UPDATE room SET status = $1 WHERE room_no = $2 RETURNING *`,
        [status, roomNo]
      );
      return result.rows[0];
    });

    res.json(updated);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});


router.delete('/:roomNo', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.withTransaction(async (client) => {
      return client.query(
  `DELETE FROM room WHERE room_no = $1 RETURNING room_no`,
        [req.params.roomNo]
      );
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ message: 'Room deleted', room_no: result.rows[0].room_no });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete — this room has admission records'
      });
    }
    next(err);
  }
});


module.exports = router;