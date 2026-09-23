const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));

function getMonth(req, res) {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    res.status(400).json({ error: 'month must be in YYYY-MM format' });
    return null;
  }
  return month;
}

router.get('/months', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT TO_CHAR(appt_date, 'YYYY-MM') AS month FROM appointment
       UNION SELECT TO_CHAR(issue_date, 'YYYY-MM') FROM bill
       UNION SELECT TO_CHAR(pay_date, 'YYYY-MM') FROM payment
       ORDER BY month DESC`
    );
    res.json(result.rows.map(r => r.month));
  } catch (err) { next(err); }
});

router.get('/summary', async (req, res, next) => {
  try {
    const month = getMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM doctor) AS total_doctors,
         (SELECT COUNT(*) FROM patient) AS total_patients,
         (SELECT COUNT(*) FROM appointment
           WHERE TO_CHAR(appt_date, 'YYYY-MM') = $1) AS month_appointments,
         (SELECT COUNT(DISTINCT patient_id) FROM appointment
           WHERE TO_CHAR(appt_date, 'YYYY-MM') = $1) AS month_patients,
         (SELECT COALESCE(SUM(total_amount), 0) FROM bill
           WHERE TO_CHAR(issue_date, 'YYYY-MM') = $1) AS month_billed,
         (SELECT COALESCE(SUM(paid_amount), 0) FROM payment
           WHERE TO_CHAR(pay_date, 'YYYY-MM') = $1) AS month_collected,
         (SELECT COALESCE(SUM(b.total_amount - COALESCE(p.paid, 0)), 0)
            FROM bill b
            LEFT JOIN (SELECT bill_id, SUM(paid_amount) AS paid
                       FROM payment GROUP BY bill_id) p ON p.bill_id = b.bill_id
         ) AS total_due,
         (SELECT COUNT(*) FROM admission WHERE discharge_date IS NULL) AS current_admissions`,
      [month]
    );
    res.json({ month, ...result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/departments', async (req, res, next) => {
  try {
    const month = getMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `WITH dept AS (
         SELECT dep.dept_id, dep.dept_name,
                COUNT(DISTINCT d.doctor_id) AS doctor_count,
                COUNT(a.appt_id) AS appointment_count,
                COUNT(DISTINCT a.patient_id) AS patient_count,
                COUNT(a.appt_id) FILTER (WHERE a.status = 'Completed') AS completed_count,
                COALESCE(SUM(d.consult_fee) FILTER (WHERE a.status = 'Completed'), 0) AS consult_revenue
         FROM department dep
         LEFT JOIN doctor d ON d.dept_id = dep.dept_id
         LEFT JOIN appointment a ON a.doctor_id = d.doctor_id
                                AND TO_CHAR(a.appt_date, 'YYYY-MM') = $1
         GROUP BY dep.dept_id, dep.dept_name
       )
       SELECT *,
              ROUND(appointment_count::numeric / NULLIF(doctor_count, 0), 2) AS load_per_doctor,
              COALESCE(
                (appointment_count::numeric / NULLIF(doctor_count, 0)) >
                AVG(appointment_count::numeric / NULLIF(doctor_count, 0)) OVER (),
                doctor_count = 0
              ) AS needs_more_doctors
       FROM dept
       ORDER BY load_per_doctor DESC NULLS FIRST`,
      [month]
    );
    res.json({ month, departments: result.rows });
  } catch (err) { next(err); }
});

router.get('/monthly', async (req, res, next) => {
  try {
    const result = await db.query(
      `WITH months AS (
         SELECT TO_CHAR(appt_date, 'YYYY-MM') AS month FROM appointment
         UNION SELECT TO_CHAR(issue_date, 'YYYY-MM') FROM bill
         UNION SELECT TO_CHAR(pay_date, 'YYYY-MM') FROM payment
       )
       SELECT m.month,
              (SELECT COUNT(*) FROM appointment
                WHERE TO_CHAR(appt_date, 'YYYY-MM') = m.month) AS appointments,
              (SELECT COALESCE(SUM(total_amount), 0) FROM bill
                WHERE TO_CHAR(issue_date, 'YYYY-MM') = m.month) AS billed,
              (SELECT COALESCE(SUM(paid_amount), 0) FROM payment
                WHERE TO_CHAR(pay_date, 'YYYY-MM') = m.month) AS collected
       FROM months m
       ORDER BY m.month DESC
       LIMIT 12`
    );
    res.json(result.rows.reverse());
  } catch (err) { next(err); }
});

module.exports = router;