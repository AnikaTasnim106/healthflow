DROP TRIGGER IF EXISTS trg_medicine_stock ON presc_medicine;
DROP TABLE IF EXISTS dispense CASCADE;


CREATE TABLE dispense (
    dispense_id   SERIAL PRIMARY KEY,
    presc_id      INT NOT NULL,
    med_id        INT NOT NULL,
    quantity      INT NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(8,2) NOT NULL CHECK (unit_price >= 0),
    dispensed_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bill_id       INT REFERENCES bill(bill_id) ON DELETE SET NULL,

    CONSTRAINT fk_dispense_line
        FOREIGN KEY (presc_id, med_id)
        REFERENCES presc_medicine(presc_id, med_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT uq_dispense_line UNIQUE (presc_id, med_id)
);

CREATE INDEX idx_dispense_presc ON dispense(presc_id);
CREATE INDEX idx_dispense_bill  ON dispense(bill_id);


CREATE OR REPLACE FUNCTION fn_dispense_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE medicine
        SET stock_qty = stock_qty - NEW.quantity
        WHERE med_id = NEW.med_id;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE medicine
        SET stock_qty = stock_qty + OLD.quantity
        WHERE med_id = OLD.med_id;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dispense_stock
AFTER INSERT OR DELETE ON dispense
FOR EACH ROW EXECUTE FUNCTION fn_dispense_stock();


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