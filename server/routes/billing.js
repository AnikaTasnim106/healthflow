

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.bill_id, b.issue_date, b.total_amount, b.pay_status,
              p.name AS patient_name,
              COALESCE(SUM(pay.paid_amount), 0) AS amount_paid,
              b.total_amount - COALESCE(SUM(pay.paid_amount), 0) AS due
       FROM bill b
       JOIN patient p    ON b.patient_id = p.patient_id
       LEFT JOIN payment pay ON b.bill_id = pay.bill_id
       GROUP BY b.bill_id, p.name
       ORDER BY b.issue_date DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});
router.get('/due', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT b.bill_id, b.issue_date, b.total_amount, b.pay_status,
              p.name AS patient_name, p.phone,
              b.total_amount - COALESCE(SUM(pay.paid_amount), 0) AS due_amount
       FROM bill b
       JOIN patient p ON b.patient_id = p.patient_id
       LEFT JOIN payment pay ON b.bill_id = pay.bill_id
       WHERE b.pay_status != 'Paid'
       GROUP BY b.bill_id, p.name, p.phone
       ORDER BY due_amount DESC`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
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

    const items    = await db.query(
      `SELECT item_no, description, amount FROM bill_item
       WHERE bill_id = $1 ORDER BY item_no`, [id]);

    const payments = await db.query(
      `SELECT payment_id, pay_date, method, paid_amount FROM payment
       WHERE bill_id = $1 ORDER BY pay_date`, [id]);

    res.json({ ...bill.rows[0], items: items.rows, payments: payments.rows });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
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

router.post('/:id/payment', async (req, res, next) => {
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