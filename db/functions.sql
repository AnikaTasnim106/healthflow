CREATE OR REPLACE FUNCTION fn_patient_due(p_patient_id INT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_due NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(b.total_amount - COALESCE(p.paid, 0)), 0)
    INTO v_due
    FROM bill b
    LEFT JOIN (
        SELECT bill_id, SUM(paid_amount) AS paid
        FROM payment GROUP BY bill_id
    ) p ON p.bill_id = b.bill_id
    WHERE b.patient_id = p_patient_id;

    RETURN v_due;
END;
$$;


CREATE OR REPLACE FUNCTION fn_doctor_revenue(p_doctor_id INT, p_month TEXT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_revenue NUMERIC(12,2);
BEGIN
    SELECT COALESCE(COUNT(a.appt_id) * d.consult_fee, 0)
    INTO v_revenue
    FROM doctor d
    LEFT JOIN appointment a ON a.doctor_id = d.doctor_id
                           AND a.status = 'Completed'
                           AND TO_CHAR(a.appt_date, 'YYYY-MM') = p_month
    WHERE d.doctor_id = p_doctor_id
    GROUP BY d.consult_fee;

    RETURN COALESCE(v_revenue, 0);
END;
$$;


CREATE OR REPLACE FUNCTION fn_occupancy_rate()
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_total    INT;
    v_occupied INT;
BEGIN
    SELECT COUNT(*) INTO v_total FROM room;
    IF v_total = 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO v_occupied FROM room WHERE status = 'Occupied';

    RETURN ROUND((v_occupied::numeric / v_total) * 100, 2);
END;
$$;


CREATE OR REPLACE FUNCTION fn_stay_cost(p_admission_id INT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_days   INT;
    v_charge NUMERIC(10,2);
BEGIN
    SELECT GREATEST(COALESCE(a.discharge_date, CURRENT_DATE) - a.admit_date, 1),
           r.daily_charge
    INTO v_days, v_charge
    FROM admission a
    JOIN room r ON a.room_no = r.room_no
    WHERE a.admission_id = p_admission_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    RETURN v_days * v_charge;
END;
$$;


CREATE OR REPLACE FUNCTION fn_patient_age(p_patient_id INT)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_dob DATE;
BEGIN
    SELECT dob INTO v_dob FROM patient WHERE patient_id = p_patient_id;

    IF v_dob IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_dob));
END;
$$;