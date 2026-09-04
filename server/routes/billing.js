// ============================================================
//  routes/billing.js — FINAL (auth + from-admission + revenue)
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ---------- GET all bills ----------
//
// admin / receptionist  → shob bill
// patient               → SHUDHU NIJER bill
//
// ⚠️ Filter ta SQL er WHERE clause e, req.user.patient_id diye.
//    Client kono id pathay na — token theke asha id use hoy.
//    Tai patient chaileo onner bill dekhte parbe na.
router.get('/', requireAuth, requireRole('admin', 'receptionist', 'patient'), async (req, res, next) => {
  try {
    const { role, patient_id } = req.user;
    const onlyMine = role === 'patient';

    const result = await db.query(
      `SELECT b.bill_id, b.issue_date, b.total_amount, b.pay_status,
              p.name AS patient_name,
              COALESCE(SUM(pay.paid_amount), 0) AS amount_paid,
              b.total_amount - COALESCE(SUM(pay.paid_amount), 0) AS due
       FROM bill b
       JOIN patient p        ON b.patient_id = p.patient_id
       LEFT JOIN payment pay ON b.bill_id    = pay.bill_id
       WHERE ($1::int IS NULL OR b.patient_id = $1)
       GROUP BY b.bill_id, p.name
       ORDER BY b.issue_date DESC`,
      [onlyMine ? patient_id : null]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET /due (admin, receptionist) — ⚠️ /:id er AGE ----------
router.get('/due', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.bill_id, b.issue_date, b.total_amount, b.pay_status,
              p.name AS patient_name, p.phone,
              b.total_amount - COALESCE(SUM(pay.paid_amount), 0) AS due_amount
       FROM bill b
       JOIN patient p        ON b.patient_id = p.patient_id
       LEFT JOIN payment pay ON b.bill_id    = pay.bill_id
       WHERE b.pay_status != 'Paid'
       GROUP BY b.bill_id, p.name, p.phone
       ORDER BY due_amount DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- GET /revenue — month-wise revenue summary (admin, receptionist) ----------
// ⚠️ /:id er AGE thakte hobe
router.get('/revenue', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT TO_CHAR(issue_date, 'YYYY-MM') AS month,
              COUNT(*) AS bill_count,
              SUM(total_amount) AS total_revenue,
              SUM(total_amount) - COALESCE(SUM(paid.total_paid), 0) AS total_due
       FROM bill b
       LEFT JOIN (
           SELECT bill_id, SUM(paid_amount) AS total_paid
           FROM payment GROUP BY bill_id
       ) paid ON b.bill_id = paid.bill_id
       GROUP BY TO_CHAR(issue_date, 'YYYY-MM')
       ORDER BY month DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

// ---------- POST /from-admission/:id — admission theke auto bill ----------
// ⚠️ /:id er AGE thakte hobe
// db/triggers.sql er sp_generate_admission_bill() procedure call kore
router.post('/from-admission/:id', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const admissionId = req.params.id;

    await db.query(`CALL sp_generate_admission_bill($1)`, [admissionId]);

    const bill = await db.query(
      `SELECT b.*, p.name AS patient_name
       FROM bill b JOIN patient p ON b.patient_id = p.patient_id
       WHERE b.admission_id = $1
       ORDER BY b.bill_id DESC LIMIT 1`,
      [admissionId]
    );

    const items = await db.query(
      `SELECT item_no, description, amount FROM bill_item
       WHERE bill_id = $1 ORDER BY item_no`,
      [bill.rows[0].bill_id]
    );

    res.status(201).json({ ...bill.rows[0], items: items.rows });
  } catch (err) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// ---------- GET ek bill (ownership check) ----------
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const bill = await db.query(
      `SELECT b.*, p.name AS patient_name, p.phone
       FROM bill b JOIN patient p ON b.patient_id = p.patient_id
       WHERE b.bill_id = $1`, [id]
    );
    if (bill.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // OBJECT-LEVEL OWNERSHIP — patient shudhu nijer bill
    const { role, patient_id } = req.user;
    if (role === 'patient' && bill.rows[0].patient_id !== patient_id) {
      return res.status(403).json({ error: 'You can only access your own bills' });
    }

    const items = await db.query(
      `SELECT item_no, description, amount FROM bill_item
       WHERE bill_id = $1 ORDER BY item_no`, [id]);

    const payments = await db.query(
      `SELECT payment_id, pay_date, method, paid_amount FROM payment
       WHERE bill_id = $1 ORDER BY pay_date`, [id]);

    res.json({ ...bill.rows[0], items: items.rows, payments: payments.rows });
  } catch (err) { next(err); }
});

// ---------- POST bill create (admin, receptionist) ----------
router.post('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { patient_id, admission_id, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one bill item required' });
    }

    const bill = await db.withTransaction(async (client) => {
      const b = await client.query(
        `INSERT INTO bill (patient_id, admission_id, total_amount)
         VALUES ($1, $2, 0) RETURNING bill_id`,
        [patient_id, admission_id || null]
      );
      const billId = b.rows[0].bill_id;

      let itemNo = 1;
      for (const it of items) {
        await client.query(
          `INSERT INTO bill_item (bill_id, item_no, description, amount)
           VALUES ($1, $2, $3, $4)`,
          [billId, itemNo++, it.description, it.amount]
        );
      }

      const final = await client.query(
        `UPDATE bill SET total_amount =
           (SELECT SUM(amount) FROM bill_item WHERE bill_id = $1)
         WHERE bill_id = $1 RETURNING *`,
        [billId]
      );
      return final.rows[0];
    });

    res.status(201).json(bill);
  } catch (err) { next(err); }
});

// ---------- POST /:id/payment (admin, receptionist) ----------
router.post('/:id/payment', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { method, paid_amount } = req.body;

    const updatedBill = await db.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO payment (bill_id, method, paid_amount)
         VALUES ($1, $2, $3)`,
        [id, method, paid_amount]
      );

      const result = await client.query(
        `UPDATE bill b
         SET pay_status = CASE
             WHEN COALESCE((SELECT SUM(paid_amount) FROM payment WHERE bill_id = b.bill_id), 0) = 0
                  THEN 'Unpaid'
             WHEN COALESCE((SELECT SUM(paid_amount) FROM payment WHERE bill_id = b.bill_id), 0) >= b.total_amount
                  THEN 'Paid'
             ELSE 'Partial'
         END
         WHERE bill_id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        throw { status: 404, message: 'Bill not found' };
      }
      return result.rows[0];
    });

    res.status(201).json(updatedBill);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;