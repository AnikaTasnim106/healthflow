// ============================================================
//  routes/medicines.js
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ---------- GET low-stock (admin, receptionist) ----------
router.get('/low-stock', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const threshold = Number(req.query.threshold) || 1500;
    const result = await db.query(
      `SELECT med_id, name, unit_price, stock_qty
       FROM medicine
       WHERE stock_qty < $1
       ORDER BY stock_qty ASC`,
      [threshold]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET all (sob role — prescription form dropdown er jonno) ----------
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT med_id, name, unit_price, stock_qty
       FROM medicine
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET ek medicine (sob role) ----------
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT med_id, name, unit_price, stock_qty
       FROM medicine WHERE med_id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;