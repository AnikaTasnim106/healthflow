-- Recalculate bill total when bill items change.
CREATE OR REPLACE FUNCTION fn_update_bill_total()
RETURNS TRIGGER AS $$
DECLARE
    target_bill INT;
BEGIN
    target_bill := COALESCE(NEW.bill_id, OLD.bill_id);

    UPDATE bill
    SET total_amount = COALESCE(
        (SELECT SUM(amount) FROM bill_item WHERE bill_id = target_bill), 0)
    WHERE bill_id = target_bill;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_bill_total ON bill_item;
CREATE TRIGGER trg_update_bill_total
AFTER INSERT OR UPDATE OR DELETE ON bill_item
FOR EACH ROW EXECUTE FUNCTION fn_update_bill_total();

-- Keep room status in sync with admissions.
CREATE OR REPLACE FUNCTION fn_room_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE room SET status = 'Occupied' WHERE room_no = NEW.room_no;

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.discharge_date IS NOT NULL AND OLD.discharge_date IS NULL THEN
            UPDATE room SET status = 'Available' WHERE room_no = NEW.room_no;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_room_status ON admission;
CREATE TRIGGER trg_room_status
AFTER INSERT OR UPDATE ON admission
FOR EACH ROW EXECUTE FUNCTION fn_room_status();

-- Reduce medicine stock for each prescription line.
CREATE OR REPLACE FUNCTION fn_medicine_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE medicine
    SET stock_qty = GREATEST(stock_qty - 10, 0)
    WHERE med_id = NEW.med_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medicine_stock ON presc_medicine;
CREATE TRIGGER trg_medicine_stock
AFTER INSERT ON presc_medicine
FOR EACH ROW EXECUTE FUNCTION fn_medicine_stock();


-- Recalculate payment status after a payment is inserted.
CREATE OR REPLACE FUNCTION fn_pay_status()
RETURNS TRIGGER AS $$
DECLARE
    target_bill INT;
BEGIN
    target_bill := NEW.bill_id;

    UPDATE bill b
    SET pay_status = CASE
        WHEN (SELECT COALESCE(SUM(paid_amount), 0) FROM payment
              WHERE bill_id = target_bill) >= b.total_amount THEN 'Paid'
        WHEN (SELECT COALESCE(SUM(paid_amount), 0) FROM payment
              WHERE bill_id = target_bill) = 0 THEN 'Unpaid'
        ELSE 'Partial'
    END
    WHERE b.bill_id = target_bill;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pay_status ON payment;
CREATE TRIGGER trg_pay_status
AFTER INSERT ON payment
FOR EACH ROW EXECUTE FUNCTION fn_pay_status();


-- Generate a bill from room, lab, and completed appointment charges.
CREATE OR REPLACE PROCEDURE sp_generate_admission_bill(p_admission_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_patient_id     INT;
    v_room_no        VARCHAR(10);
    v_admit_date     DATE;
    v_discharge_date DATE;
    v_daily_charge   NUMERIC(10,2);
    v_days           INT;
    v_bill_id        INT;
    v_item_no        INT := 1;
    v_room_charge    NUMERIC(12,2);
    test_rec         RECORD;
    fee_rec          RECORD;
BEGIN
    SELECT a.patient_id, a.room_no, a.admit_date, a.discharge_date, r.daily_charge
    INTO v_patient_id, v_room_no, v_admit_date, v_discharge_date, v_daily_charge
    FROM admission a
    JOIN room r ON a.room_no = r.room_no
    WHERE a.admission_id = p_admission_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission % not found', p_admission_id;
    END IF;

    v_days := GREATEST(COALESCE(v_discharge_date, CURRENT_DATE) - v_admit_date, 1);
    v_room_charge := v_days * v_daily_charge;

    INSERT INTO bill (patient_id, admission_id, total_amount, pay_status)
    VALUES (v_patient_id, p_admission_id, 0, 'Unpaid')
    RETURNING bill_id INTO v_bill_id;

    INSERT INTO bill_item (bill_id, item_no, description, amount)
    VALUES (v_bill_id, v_item_no,
            format('Room charge — %s x %s days', v_room_no, v_days),
            v_room_charge);
    v_item_no := v_item_no + 1;

    FOR test_rec IN
        SELECT lt.test_name, lt.cost
        FROM patient_test pt
        JOIN lab_test lt ON pt.test_id = lt.test_id
        WHERE pt.patient_id = v_patient_id
          AND pt.test_date BETWEEN v_admit_date AND COALESCE(v_discharge_date, CURRENT_DATE)
    LOOP
        INSERT INTO bill_item (bill_id, item_no, description, amount)
        VALUES (v_bill_id, v_item_no, test_rec.test_name, test_rec.cost);
        v_item_no := v_item_no + 1;
    END LOOP;

    FOR fee_rec IN
        SELECT d.name, d.consult_fee
        FROM appointment ap
        JOIN doctor d ON ap.doctor_id = d.doctor_id
        WHERE ap.patient_id = v_patient_id
          AND ap.status = 'Completed'
          AND ap.appt_date BETWEEN v_admit_date AND COALESCE(v_discharge_date, CURRENT_DATE)
    LOOP
        INSERT INTO bill_item (bill_id, item_no, description, amount)
        VALUES (v_bill_id, v_item_no,
                format('Doctor visit — %s', fee_rec.name),
                fee_rec.consult_fee);
        v_item_no := v_item_no + 1;
    END LOOP;

    RAISE NOTICE 'Bill % generated for admission %', v_bill_id, p_admission_id;
END;
$$;


-- Discharge a patient and generate the admission bill.
CREATE OR REPLACE PROCEDURE sp_discharge_patient(p_admission_id INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_room_no VARCHAR(10);
BEGIN
    UPDATE admission
    SET discharge_date = CURRENT_DATE
    WHERE admission_id = p_admission_id AND discharge_date IS NULL
    RETURNING room_no INTO v_room_no;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admission % not found or already discharged', p_admission_id;
    END IF;

    CALL sp_generate_admission_bill(p_admission_id);
END;
$$;


