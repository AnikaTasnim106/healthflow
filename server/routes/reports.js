const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));

function readMonth(req, res) {
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
    const month = readMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM doctor) AS total_doctors,
         (SELECT COUNT(*) FROM patient) AS total_patients,
         (SELECT COUNT(*) FROM appointment
           WHERE TO_CHAR(appt_date, 'YYYY-MM') = $1) AS month_appointments,
         (SELECT COUNT(DISTINCT patient_id) FROM appointment
           WHERE TO_CHAR(appt_date, 'YYYY-MM') = $1) AS month_patients,
         (SELECT COUNT(*) FROM admission
           WHERE TO_CHAR(admit_date, 'YYYY-MM') = $1) AS month_admissions,
         (SELECT COALESCE(SUM(total_amount), 0) FROM bill
           WHERE TO_CHAR(issue_date, 'YYYY-MM') = $1) AS month_billed,
         (SELECT COALESCE(SUM(paid_amount), 0) FROM payment
           WHERE TO_CHAR(pay_date, 'YYYY-MM') = $1) AS month_collected,
         (SELECT COALESCE(SUM(b.total_amount - COALESCE(p.paid, 0)), 0)
            FROM bill b
            LEFT JOIN (SELECT bill_id, SUM(paid_amount) AS paid
                       FROM payment GROUP BY bill_id) p ON p.bill_id = b.bill_id
         ) AS total_due,
         (SELECT COUNT(*) FROM bill WHERE pay_status <> 'Paid') AS unpaid_bills,
         (SELECT COUNT(*) FROM admission WHERE discharge_date IS NULL) AS current_admissions,
         (SELECT COUNT(*) FROM room) AS total_rooms,
         (SELECT COUNT(*) FROM room WHERE status = 'Occupied') AS occupied_rooms,
         (SELECT COUNT(*) FROM medicine WHERE stock_qty < 1500) AS low_stock_medicines`,
      [month]
    );

    res.json({ month, ...result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/departments', async (req, res, next) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `WITH dept AS (
         SELECT dep.dept_id, dep.dept_name,
                COUNT(DISTINCT d.doctor_id) AS doctor_count,
                COUNT(a.appt_id) AS appointment_count,
                COUNT(DISTINCT a.patient_id) AS patient_count,
                COUNT(a.appt_id) FILTER (WHERE a.status = 'Completed') AS completed_count,
                COUNT(a.appt_id) FILTER (WHERE a.status = 'Cancelled') AS cancelled_count,
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

router.get('/revenue-sources', async (req, res, next) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT 'Consultation' AS source,
              COALESCE(SUM(d.consult_fee), 0) AS amount
         FROM appointment a
         JOIN doctor d ON d.doctor_id = a.doctor_id
        WHERE a.status = 'Completed'
          AND TO_CHAR(a.appt_date, 'YYYY-MM') = $1
       UNION ALL
       SELECT 'Lab tests',
              COALESCE(SUM(lt.cost), 0)
         FROM patient_test pt
         JOIN lab_test lt ON lt.test_id = pt.test_id
        WHERE TO_CHAR(pt.test_date, 'YYYY-MM') = $1
       UNION ALL
       SELECT 'Pharmacy',
              COALESCE(SUM(ds.quantity * ds.unit_price), 0)
         FROM dispense ds
        WHERE TO_CHAR(ds.dispensed_at, 'YYYY-MM') = $1
       UNION ALL
       SELECT 'Room charges',
              COALESCE(SUM(
                GREATEST(COALESCE(ad.discharge_date, CURRENT_DATE) - ad.admit_date, 1) * r.daily_charge
              ), 0)
         FROM admission ad
         JOIN room r ON r.room_no = ad.room_no
        WHERE TO_CHAR(ad.admit_date, 'YYYY-MM') = $1`,
      [month]
    );

    res.json({ month, sources: result.rows });
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

router.get('/top-doctors', async (req, res, next) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const result = await db.query(
      `SELECT d.doctor_id, d.name, dep.dept_name,
              COUNT(a.appt_id) AS appointment_count,
              COUNT(a.appt_id) FILTER (WHERE a.status = 'Completed') AS completed_count,
              COALESCE(SUM(d.consult_fee) FILTER (WHERE a.status = 'Completed'), 0) AS revenue
         FROM doctor d
         JOIN department dep ON dep.dept_id = d.dept_id
         LEFT JOIN appointment a ON a.doctor_id = d.doctor_id
                                AND TO_CHAR(a.appt_date, 'YYYY-MM') = $1
        GROUP BY d.doctor_id, d.name, dep.dept_name
        ORDER BY appointment_count DESC, revenue DESC
        LIMIT 5`,
      [month]
    );

    res.json({ month, doctors: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;