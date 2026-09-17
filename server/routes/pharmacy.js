const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/queue', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { patient_id, pending } = req.query;
    const onlyPending = pending !== 'false';

    const result = await db.query(
      `SELECT presc_id, med_id, medicine_name, current_price, stock_qty,
              dosage, frequency, duration, presc_date,
              patient_id, patient_name, doctor_name,
              dispense_id, dispensed_qty, dispensed_price, dispensed_at,
              is_dispensed
       FROM v_prescription_lines
       WHERE ($1::int IS NULL OR patient_id = $1)
         AND ($2::boolean IS FALSE OR is_dispensed = FALSE)
       ORDER BY presc_date DESC, presc_id, medicine_name`,
      [patient_id || null, onlyPending]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});


router.get('/prescription/:prescId', requireAuth, async (req, res, next) => {
  try {
    const { prescId } = req.params;
    const { role, patient_id, doctor_id } = req.user;

    const result = await db.query(
      `SELECT presc_id, med_id, medicine_name, current_price, stock_qty,
              dosage, frequency, duration,
              patient_id, doctor_id,
              dispense_id, dispensed_qty, dispensed_price, dispensed_at,
              is_dispensed
       FROM v_prescription_lines
       WHERE presc_id = $1
       ORDER BY medicine_name`,
      [prescId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const owner = result.rows[0];
    if (role === 'patient' && owner.patient_id !== patient_id) {
      return res.status(403).json({ error: 'You can only view your own prescriptions' });
    }
    if (role === 'doctor' && owner.doctor_id !== doctor_id) {
      return res.status(403).json({ error: 'You can only view prescriptions you wrote' });
    }

    res.json(result.rows);
  } catch (err) { next(err); }
});


router.post('/dispense', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { presc_id, lines, charge_to_bill } = req.body;

    if (!presc_id || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({
        error: 'A prescription and at least one medicine are required'
      });
    }

    const result = await db.withTransaction(async (client) => {
      const presc = await client.query(
        `SELECT a.patient_id, p.name AS patient_name
         FROM prescription pr
         JOIN appointment a ON pr.appt_id   = a.appt_id
         JOIN patient p     ON a.patient_id = p.patient_id
         WHERE pr.presc_id = $1`,
        [presc_id]
      );

      if (presc.rows.length === 0) {
        throw { status: 404, message: 'Prescription not found' };
      }
      const patientId = presc.rows[0].patient_id;

      let billId = null;
      if (charge_to_bill) {
        const open = await client.query(
          `SELECT bill_id FROM bill
           WHERE patient_id = $1 AND pay_status <> 'Paid'
           ORDER BY issue_date DESC LIMIT 1`,
          [patientId]
        );

        if (open.rows.length > 0) {
          billId = open.rows[0].bill_id;
        } else {
          const nb = await client.query(
            `INSERT INTO bill (patient_id, total_amount) VALUES ($1, 0)
             RETURNING bill_id`,
            [patientId]
          );
          billId = nb.rows[0].bill_id;
        }
      }

      const dispensed = [];

      for (const line of lines) {
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) {
          throw { status: 400, message: 'Every medicine needs a quantity above zero' };
        }

        const med = await client.query(
          `SELECT m.med_id, m.name, m.unit_price, m.stock_qty
           FROM presc_medicine pm
           JOIN medicine m ON pm.med_id = m.med_id
           WHERE pm.presc_id = $1 AND pm.med_id = $2
           FOR UPDATE OF m`,
          [presc_id, line.med_id]
        );

        if (med.rows.length === 0) {
          throw { status: 400, message: 'That medicine is not on this prescription' };
        }

        const m = med.rows[0];

        if (Number(m.stock_qty) < qty) {
          throw {
            status: 409,
            message: `Not enough ${m.name} in stock — ${m.stock_qty} left, ${qty} requested`
          };
        }

        const d = await client.query(
          `INSERT INTO dispense (presc_id, med_id, quantity, unit_price, bill_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING dispense_id, quantity, unit_price`,
          [presc_id, line.med_id, qty, m.unit_price, billId]
        );

        if (billId) {
          const nextItem = await client.query(
            `SELECT COALESCE(MAX(item_no), 0) + 1 AS item_no
             FROM bill_item WHERE bill_id = $1`,
            [billId]
          );

          await client.query(
            `INSERT INTO bill_item (bill_id, item_no, description, amount)
             VALUES ($1, $2, $3, $4)`,
            [
              billId,
              nextItem.rows[0].item_no,
              `Medicine — ${m.name} x ${qty}`,
              Number(m.unit_price) * qty
            ]
          );
        }

        dispensed.push({
          med_id: m.med_id,
          name: m.name,
          quantity: qty,
          unit_price: Number(m.unit_price),
          line_total: Number(m.unit_price) * qty
        });
      }

      return {
        presc_id: Number(presc_id),
        patient_id: patientId,
        patient_name: presc.rows[0].patient_name,
        bill_id: billId,
        items: dispensed,
        total: dispensed.reduce((s, x) => s + x.line_total, 0)
      };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'One of these medicines has already been dispensed for this prescription'
      });
    }
    if (err.code === '23514') {
      return res.status(409).json({ error: 'That would take stock below zero' });
    }
    next(err);
  }
});


router.delete('/dispense/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await db.query(
      `DELETE FROM dispense WHERE dispense_id = $1 RETURNING dispense_id, med_id, quantity`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispense record not found' });
    }
    res.json({ message: 'Dispense reversed, stock restored', ...result.rows[0] });
  } catch (err) { next(err); }
});


module.exports = router;