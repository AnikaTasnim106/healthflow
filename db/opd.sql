ALTER TABLE dispense ADD COLUMN IF NOT EXISTS patient_id INT;

ALTER TABLE dispense
    DROP CONSTRAINT IF EXISTS fk_dispense_patient;
ALTER TABLE dispense
    ADD CONSTRAINT fk_dispense_patient
    FOREIGN KEY (patient_id) REFERENCES patient(patient_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE dispense ALTER COLUMN presc_id DROP NOT NULL;

ALTER TABLE dispense
    DROP CONSTRAINT IF EXISTS fk_dispense_med;
ALTER TABLE dispense
    ADD CONSTRAINT fk_dispense_med
    FOREIGN KEY (med_id) REFERENCES medicine(med_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE dispense
    DROP CONSTRAINT IF EXISTS chk_dispense_source;
ALTER TABLE dispense
    ADD CONSTRAINT chk_dispense_source CHECK (
        presc_id IS NOT NULL
        OR (presc_id IS NULL AND patient_id IS NOT NULL)
    );

ALTER TABLE dispense DROP CONSTRAINT IF EXISTS uq_dispense_line;
DROP INDEX IF EXISTS uq_dispense_line;

CREATE UNIQUE INDEX uq_dispense_line
    ON dispense(presc_id, med_id)
    WHERE presc_id IS NOT NULL;


CREATE OR REPLACE VIEW v_prescription_lines AS
SELECT pm.presc_id,
       pm.med_id,
       m.name          AS medicine_name,
       m.unit_price    AS current_price,
       m.stock_qty,
       pm.dosage,
       pm.frequency,
       pm.duration,
       pr.presc_date,
       a.patient_id,
       p.name          AS patient_name,
       a.doctor_id,
       d.name          AS doctor_name,
       ds.dispense_id,
       ds.quantity     AS dispensed_qty,
       ds.unit_price   AS dispensed_price,
       ds.dispensed_at,
       (ds.dispense_id IS NOT NULL) AS is_dispensed
FROM presc_medicine pm
JOIN medicine m       ON pm.med_id   = m.med_id
JOIN prescription pr  ON pm.presc_id = pr.presc_id
JOIN appointment a    ON pr.appt_id  = a.appt_id
JOIN patient p        ON a.patient_id = p.patient_id
JOIN doctor d         ON a.doctor_id  = d.doctor_id
LEFT JOIN dispense ds ON ds.presc_id = pm.presc_id
                     AND ds.med_id   = pm.med_id;


CREATE OR REPLACE PROCEDURE sp_generate_opd_bill(p_appt_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patient_id  INT;
    v_doctor_id   INT;
    v_doctor_name VARCHAR(80);
    v_fee         NUMERIC(8,2);
    v_appt_date   DATE;
    v_status      VARCHAR(12);
    v_admitted    INT;
    v_bill_id     INT;
    v_item_no     INT;
    v_existing    INT;
    test_rec      RECORD;
BEGIN
    SELECT a.patient_id, a.doctor_id, a.appt_date, a.status,
           d.name, d.consult_fee
    INTO v_patient_id, v_doctor_id, v_appt_date, v_status,
         v_doctor_name, v_fee
    FROM appointment a
    JOIN doctor d ON a.doctor_id = d.doctor_id
    WHERE a.appt_id = p_appt_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment % not found', p_appt_id;
    END IF;

    IF v_status <> 'Completed' THEN
        RAISE EXCEPTION 'Appointment % is marked % — only a completed visit can be billed',
            p_appt_id, v_status;
    END IF;

    SELECT COUNT(*) INTO v_admitted
    FROM admission
    WHERE patient_id = v_patient_id
      AND v_appt_date BETWEEN admit_date
                          AND COALESCE(discharge_date, CURRENT_DATE);

    IF v_admitted > 0 THEN
        RAISE EXCEPTION 'This visit falls inside an admission — it is billed with the stay';
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM bill b
    JOIN bill_item bi ON bi.bill_id = b.bill_id
    WHERE b.patient_id = v_patient_id
      AND b.admission_id IS NULL
      AND bi.description = format('Consultation - %s (%s)', v_doctor_name, v_appt_date);

    IF v_existing > 0 THEN
        RAISE EXCEPTION 'This visit has already been billed';
    END IF;

    SELECT bill_id INTO v_bill_id
    FROM bill
    WHERE patient_id = v_patient_id
      AND admission_id IS NULL
      AND pay_status = 'Unpaid'
    ORDER BY issue_date DESC
    LIMIT 1;

    IF NOT FOUND THEN
        INSERT INTO bill (patient_id, admission_id, total_amount, pay_status)
        VALUES (v_patient_id, NULL, 0, 'Unpaid')
        RETURNING bill_id INTO v_bill_id;
    END IF;

    SELECT COALESCE(MAX(item_no), 0) + 1 INTO v_item_no
    FROM bill_item WHERE bill_id = v_bill_id;

    INSERT INTO bill_item (bill_id, item_no, description, amount)
    VALUES (v_bill_id, v_item_no,
            format('Consultation - %s (%s)', v_doctor_name, v_appt_date),
            v_fee);
    v_item_no := v_item_no + 1;

    FOR test_rec IN
        SELECT lt.test_name, lt.cost
        FROM patient_test pt
        JOIN lab_test lt ON pt.test_id = lt.test_id
        WHERE pt.patient_id = v_patient_id
          AND pt.doctor_id  = v_doctor_id
          AND pt.test_date  = v_appt_date
          AND NOT EXISTS (
              SELECT 1 FROM bill_item bi2
              JOIN bill b2 ON bi2.bill_id = b2.bill_id
              WHERE b2.patient_id = v_patient_id
                AND bi2.description = format('Lab test - %s', lt.test_name)
          )
    LOOP
        INSERT INTO bill_item (bill_id, item_no, description, amount)
        VALUES (v_bill_id, v_item_no,
                format('Lab test - %s', test_rec.test_name),
                test_rec.cost);
        v_item_no := v_item_no + 1;
    END LOOP;

    RAISE NOTICE 'Outpatient bill % updated for appointment %', v_bill_id, p_appt_id;
END;
$$;