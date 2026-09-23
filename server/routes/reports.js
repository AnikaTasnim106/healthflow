const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));

const LOW_STOCK = 1500;

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
       UNION SELECT TO_CHAR(admit_date, 'YYYY-MM') FROM admission
       ORDER BY month DESC`
    );
    res.json(result.rows.map((r) => r.month).filter(Boolean));
  } catch (err) { next(err); }
});


router.get('/summary', async (req, res, next) => {
  try {
    const month = getMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM doctor)  AS total_doctors,
         (SELECT COUNT(*) FROM patient) AS total_patients,

         (SELECT COUNT(*) FROM appointment
          WHERE TO_CHAR(appt_date, 'YYYY-MM') = $1) AS month_appointments,

         (SELECT COUNT(DISTINCT patient_id) FROM appointment
          WHERE TO_CHAR(appt_date, 'YYYY-MM') = $1) AS month_patients,

         (SELECT COUNT(*) FROM admission
          WHERE TO_CHAR(admit_date, 'YYYY-MM') = $1) AS month_admissions,

         (SELECT COUNT(*) FROM admission
          WHERE discharge_date IS NULL) AS current_admissions,

         (SELECT COALESCE(SUM(total_amount), 0) FROM bill
          WHERE TO_CHAR(issue_date, 'YYYY-MM') = $1) AS month_billed,

         (SELECT COALESCE(SUM(paid_amount), 0) FROM payment
          WHERE TO_CHAR(pay_date, 'YYYY-MM') = $1) AS month_collected,

         (SELECT COALESCE(SUM(b.total_amount - COALESCE(p.paid, 0)), 0)
          FROM bill b
          LEFT JOIN (SELECT bill_id, SUM(paid_amount) AS paid
                     FROM payment GROUP BY bill_id) p ON p.bill_id = b.bill_id
         ) AS total_due,

         (SELECT COUNT(*) FROM bill
          WHERE pay_status <> 'Paid') AS unpaid_bills,

         (SELECT COUNT(*) FROM room) AS total_rooms,

         (SELECT COUNT(*) FROM room
          WHERE status = 'Occupied') AS occupied_rooms,

         (SELECT COUNT(*) FROM medicine
          WHERE stock_qty < $2) AS low_stock_medicines`,
      [month, LOW_STOCK]
    );

    res.json({ month, ...result.rows[0] });
  } catch (err) { next(err); }
});


router.get('/revenue-sources', async (req, res, next) => {
  try {
    const month = getMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT CASE
                WHEN bi.description LIKE 'Consultation%' THEN 'Consultation'
                WHEN bi.description LIKE 'Room charge%'  THEN 'Room charges'
                WHEN bi.description LIKE 'Lab test%'     THEN 'Lab tests'
                WHEN bi.description LIKE 'Medicine%'     THEN 'Medicines'
                ELSE 'Other'
              END AS source,
              COALESCE(SUM(bi.amount), 0) AS amount,
              COUNT(*) AS line_count
       FROM bill_item bi
       JOIN bill b ON bi.bill_id = b.bill_id
       WHERE TO_CHAR(b.issue_date, 'YYYY-MM') = $1
       GROUP BY 1
       ORDER BY amount DESC`,
      [month]
    );

    res.json({ month, sources: result.rows });
  } catch (err) { next(err); }
});


router.get('/top-doctors', async (req, res, next) => {
  try {
    const month = getMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT d.doctor_id, d.name, dep.dept_name, d.consult_fee,
              COUNT(a.appt_id) AS appointment_count,
              COUNT(a.appt_id) FILTER (WHERE a.status = 'Completed') AS completed_count,
              COUNT(DISTINCT a.patient_id) AS patient_count,
              COALESCE(
                COUNT(a.appt_id) FILTER (WHERE a.status = 'Completed') * d.consult_fee,
                0
              ) AS revenue
       FROM doctor d
       JOIN department dep ON d.dept_id = dep.dept_id
       LEFT JOIN appointment a ON a.doctor_id = d.doctor_id
                              AND TO_CHAR(a.appt_date, 'YYYY-MM') = $1
       GROUP BY d.doctor_id, d.name, dep.dept_name, d.consult_fee
       HAVING COUNT(a.appt_id) > 0
       ORDER BY appointment_count DESC, revenue DESC
       LIMIT 10`,
      [month]
    );

    res.json({ month, doctors: result.rows });
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
                COALESCE(SUM(d.consult_fee) FILTER (WHERE a.status = 'Completed'), 0)
                  AS consult_revenue
         FROM department dep
         LEFT JOIN doctor d ON d.dept_id = dep.dept_id
         LEFT JOIN appointment a ON a.doctor_id = d.doctor_id
                                AND TO_CHAR(a.appt_date, 'YYYY-MM') = $1
         GROUP BY dep.dept_id, dep.dept_name
       )
       SELECT *,
              ROUND(appointment_count::numeric / NULLIF(doctor_count, 0), 2)
                AS load_per_doctor,
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
       WHERE m.month IS NOT NULL
       ORDER BY m.month DESC
       LIMIT 12`
    );
    res.json(result.rows.reverse());
  } catch (err) { next(err); }
});


module.exports = router;