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
        const admitted = await client.query(
          `SELECT b.bill_id
           FROM admission a
           JOIN bill b ON b.admission_id = a.admission_id
           WHERE a.patient_id = $1
             AND a.discharge_date IS NULL
             AND b.pay_status <> 'Paid'
           ORDER BY a.admit_date DESC
           LIMIT 1`,
          [patientId]
        );

        if (admitted.rows.length > 0) {
          billId = admitted.rows[0].bill_id;
        } else {
          const opd = await client.query(
            `SELECT bill_id FROM bill
             WHERE patient_id = $1
               AND admission_id IS NULL
               AND pay_status = 'Unpaid'
             ORDER BY issue_date DESC LIMIT 1`,
            [patientId]
          );

          if (opd.rows.length > 0) {
            billId = opd.rows[0].bill_id;
          } else {
            const nb = await client.query(
              `INSERT INTO bill (patient_id, total_amount) VALUES ($1, 0)
               RETURNING bill_id`,
              [patientId]
            );
            billId = nb.rows[0].bill_id;
          }
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

        let itemNo = null;

        if (billId) {
          const nextItem = await client.query(
            `SELECT COALESCE(MAX(item_no), 0) + 1 AS item_no
             FROM bill_item WHERE bill_id = $1`,
            [billId]
          );
          itemNo = nextItem.rows[0].item_no;

          await client.query(
            `INSERT INTO bill_item (bill_id, item_no, description, amount)
             VALUES ($1, $2, $3, $4)`,
            [
              billId,
              itemNo,
              `Medicine - ${m.name} x ${qty}`,
              Number(m.unit_price) * qty
            ]
          );
        }

        await client.query(
          `INSERT INTO dispense
             (presc_id, med_id, quantity, unit_price, bill_id, bill_item_no)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [presc_id, line.med_id, qty, m.unit_price, billId, itemNo]
        );

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


router.post('/sell', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const { patient_id, lines, charge_to_bill } = req.body;

    if (!patient_id) {
      return res.status(400).json({
        error: 'Register the buyer as a patient first, then record the sale against them'
      });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Add at least one medicine' });
    }

    const result = await db.withTransaction(async (client) => {
      const who = await client.query(
        `SELECT name FROM patient WHERE patient_id = $1`,
        [patient_id]
      );
      if (who.rows.length === 0) {
        throw { status: 404, message: 'Patient not found' };
      }

      let billId = null;
      if (charge_to_bill) {
        const opd = await client.query(
          `SELECT bill_id FROM bill
           WHERE patient_id = $1 AND admission_id IS NULL AND pay_status = 'Unpaid'
           ORDER BY issue_date DESC LIMIT 1`,
          [patient_id]
        );

        if (opd.rows.length > 0) {
          billId = opd.rows[0].bill_id;
        } else {
          const nb = await client.query(
            `INSERT INTO bill (patient_id, total_amount) VALUES ($1, 0)
             RETURNING bill_id`,
            [patient_id]
          );
          billId = nb.rows[0].bill_id;
        }
      }

      const sold = [];

      for (const line of lines) {
        const qty = Number(line.quantity);
        if (!qty || qty <= 0) {
          throw { status: 400, message: 'Every medicine needs a quantity above zero' };
        }

        const med = await client.query(
          `SELECT med_id, name, unit_price, stock_qty
           FROM medicine WHERE med_id = $1 FOR UPDATE`,
          [line.med_id]
        );

        if (med.rows.length === 0) {
          throw { status: 404, message: 'Medicine not found' };
        }

        const m = med.rows[0];

        if (Number(m.stock_qty) < qty) {
          throw {
            status: 409,
            message: `Not enough ${m.name} in stock - ${m.stock_qty} left, ${qty} requested`
          };
        }

        let itemNo = null;

        if (billId) {
          const nextItem = await client.query(
            `SELECT COALESCE(MAX(item_no), 0) + 1 AS item_no
             FROM bill_item WHERE bill_id = $1`,
            [billId]
          );
          itemNo = nextItem.rows[0].item_no;

          await client.query(
            `INSERT INTO bill_item (bill_id, item_no, description, amount)
             VALUES ($1, $2, $3, $4)`,
            [billId, itemNo, `Medicine - ${m.name} x ${qty}`, Number(m.unit_price) * qty]
          );
        }

        await client.query(
          `INSERT INTO dispense
             (presc_id, med_id, patient_id, quantity, unit_price, bill_id, bill_item_no)
           VALUES (NULL, $1, $2, $3, $4, $5, $6)`,
          [line.med_id, patient_id, qty, m.unit_price, billId, itemNo]
        );

        sold.push({
          med_id: m.med_id,
          name: m.name,
          quantity: qty,
          unit_price: Number(m.unit_price),
          line_total: Number(m.unit_price) * qty
        });
      }

      return {
        patient_id: Number(patient_id),
        patient_name: who.rows[0].name,
        bill_id: billId,
        items: sold,
        total: sold.reduce((s2, x) => s2 + x.line_total, 0)
      };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23514') {
      return res.status(409).json({ error: 'That would take stock below zero' });
    }
    next(err);
  }
});

router.get('/sales', requireAuth, requireRole('admin', 'receptionist'), async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT ds.dispense_id, ds.quantity, ds.unit_price, ds.dispensed_at,
              ds.bill_id, m.name AS medicine_name,
              COALESCE(p1.name, p2.name) AS patient_name,
              (ds.presc_id IS NULL) AS over_the_counter
       FROM dispense ds
       JOIN medicine m ON ds.med_id = m.med_id
       LEFT JOIN patient p1 ON ds.patient_id = p1.patient_id
       LEFT JOIN prescription pr ON ds.presc_id = pr.presc_id
       LEFT JOIN appointment a   ON pr.appt_id  = a.appt_id
       LEFT JOIN patient p2      ON a.patient_id = p2.patient_id
       ORDER BY ds.dispensed_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.delete('/dispense/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const reversed = await db.withTransaction(async (client) => {
      const d = await client.query(
        `SELECT ds.dispense_id, ds.med_id, ds.quantity, ds.unit_price,
                ds.bill_id, ds.bill_item_no,
                m.name AS medicine_name
         FROM dispense ds
         JOIN medicine m ON ds.med_id = m.med_id
         WHERE ds.dispense_id = $1
         FOR UPDATE OF ds`,
        [req.params.id]
      );

      if (d.rows.length === 0) {
        throw { status: 404, message: 'Dispense record not found' };
      }

      const row = d.rows[0];

      if (row.bill_id) {
        const bill = await client.query(
          `SELECT pay_status FROM bill WHERE bill_id = $1 FOR UPDATE`,
          [row.bill_id]
        );

        if (bill.rows.length > 0 && bill.rows[0].pay_status !== 'Unpaid') {
          throw {
            status: 409,
            message: `Bill B-${String(row.bill_id).padStart(3, '0')} has already been paid against — refund it at the counter instead of reversing`
          };
        }

        if (row.bill_item_no !== null) {
          await client.query(
            `DELETE FROM bill_item WHERE bill_id = $1 AND item_no = $2`,
            [row.bill_id, row.bill_item_no]
          );
        }
      }

      await client.query(
        `DELETE FROM dispense WHERE dispense_id = $1`,
        [req.params.id]
      );

      return row;
    });

    res.json({
      message: 'Dispense reversed, stock restored and the charge removed',
      dispense_id: reversed.dispense_id,
      medicine: reversed.medicine_name,
      quantity: reversed.quantity,
      bill_id: reversed.bill_id
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});


module.exports = router;