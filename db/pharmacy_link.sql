ALTER TABLE dispense
    ADD COLUMN IF NOT EXISTS bill_item_no INT;

ALTER TABLE dispense
    DROP CONSTRAINT IF EXISTS fk_dispense_bill_item;

ALTER TABLE dispense
    ADD CONSTRAINT fk_dispense_bill_item
    FOREIGN KEY (bill_id, bill_item_no)
    REFERENCES bill_item(bill_id, item_no)
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dispense_bill_item
    ON dispense(bill_id, bill_item_no);