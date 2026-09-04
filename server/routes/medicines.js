
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/low-stock', async (req, res, next) => {
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

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT med_id, name, unit_price, stock_qty
       FROM medicine
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
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