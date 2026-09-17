const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const nz = (v) => (v === '' || v === undefined ? null : v);

router.get('/low-stock', requireAuth, requireRole('admin', 'receptionist', 'doctor'), async (req, res, next) => {
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


router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const result = await db.query(
      `SELECT med_id, name, unit_price, stock_qty
       FROM medicine
       WHERE name ILIKE $1
       ORDER BY name`,
      [`%${search}%`]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


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


router.post('/', requireAuth, requireRole('admin', 'doctor'), async (req, res, next) => {
  try {
    const { name, unit_price, stock_qty } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Medicine name is required' });
    }

    const result = await db.query(
      `INSERT INTO medicine (name, unit_price, stock_qty)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        name.trim(),
        unit_price === '' || unit_price == null ? 0 : Number(unit_price),
        stock_qty === '' || stock_qty == null ? 0 : Number(stock_qty),
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Price and stock cannot be negative' });
    }
    next(err);
  }
});


router.put('/:id', requireAuth, requireRole('admin', 'doctor'), async (req, res, next) => {
  try {
    const { name, unit_price } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Medicine name is required' });
    }

    const result = await db.query(
      `UPDATE medicine
       SET name = $1, unit_price = $2
       WHERE med_id = $3
       RETURNING *`,
      [
        name.trim(),
        unit_price === '' || unit_price == null ? 0 : Number(unit_price),
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Price cannot be negative' });
    }
    next(err);
  }
});


router.patch('/:id/stock', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);

    if (!qty || Number.isNaN(qty)) {
      return res.status(400).json({ error: 'Enter how many units to add or remove' });
    }

    const result = await db.query(
      `UPDATE medicine
       SET stock_qty = stock_qty + $1
       WHERE med_id = $2
       RETURNING *`,
      [qty, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Stock cannot go below zero' });
    }
    next(err);
  }
});


router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM medicine WHERE med_id = $1 RETURNING med_id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json({ message: 'Medicine deleted', med_id: result.rows[0].med_id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete — this medicine is used in existing prescriptions'
      });
    }
    next(err);
  }
});


module.exports = router;