

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res, next) => {
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

module.exports = router;