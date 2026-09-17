const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const nz = (v) => (v === '' || v === undefined ? null : v);

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT dep.dept_id, dep.dept_name, dep.location,
              COUNT(d.doctor_id) AS doctor_count
       FROM department dep
       LEFT JOIN doctor d ON dep.dept_id = d.dept_id
       GROUP BY dep.dept_id, dep.dept_name, dep.location
       ORDER BY dep.dept_name`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { dept_name, location } = req.body;

    if (!dept_name || !dept_name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const result = await db.query(
      `INSERT INTO department (dept_name, location)
       VALUES ($1, $2) RETURNING *`,
      [dept_name.trim(), nz(location)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A department with that name already exists' });
    }
    next(err);
  }
});


router.put('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { dept_name, location } = req.body;

    if (!dept_name || !dept_name.trim()) {
      return res.status(400).json({ error: 'Department name is required' });
    }

    const result = await db.query(
      `UPDATE department
       SET dept_name = $1, location = $2
       WHERE dept_id = $3
       RETURNING *`,
      [dept_name.trim(), nz(location), req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A department with that name already exists' });
    }
    next(err);
  }
});


router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM department WHERE dept_id = $1 RETURNING dept_id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ message: 'Department deleted', dept_id: result.rows[0].dept_id });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Cannot delete — this department still has doctors'
      });
    }
    next(err);
  }
});


module.exports = router;