DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS bill_item CASCADE;
DROP TABLE IF EXISTS bill CASCADE;
DROP TABLE IF EXISTS admission CASCADE;
DROP TABLE IF EXISTS patient_test CASCADE;
DROP TABLE IF EXISTS presc_medicine CASCADE;
DROP TABLE IF EXISTS prescription CASCADE;
DROP TABLE IF EXISTS appointment CASCADE;
DROP TABLE IF EXISTS doctor_schedule CASCADE;
DROP TABLE IF EXISTS lab_test CASCADE;
DROP TABLE IF EXISTS medicine CASCADE;
DROP TABLE IF EXISTS room CASCADE;
DROP TABLE IF EXISTS patient CASCADE;
DROP TABLE IF EXISTS doctor CASCADE;
DROP TABLE IF EXISTS department CASCADE;



CREATE TABLE department (
    dept_id     SERIAL PRIMARY KEY,
    dept_name   VARCHAR(60)  NOT NULL UNIQUE,
    location    VARCHAR(80)
);


CREATE TABLE doctor (
    doctor_id      SERIAL PRIMARY KEY,
    name           VARCHAR(80)  NOT NULL,
    specialization VARCHAR(60),
    phone          VARCHAR(15)  UNIQUE,
    consult_fee    NUMERIC(8,2) NOT NULL DEFAULT 0
                   CHECK (consult_fee >= 0),
    dept_id        INT NOT NULL
                   REFERENCES department(dept_id)
                   ON UPDATE CASCADE ON DELETE RESTRICT
);


CREATE TABLE patient (
    patient_id   SERIAL PRIMARY KEY,
    name         VARCHAR(80) NOT NULL,
    dob          DATE        CHECK (dob <= CURRENT_DATE),
    gender       CHAR(1)     CHECK (gender IN ('M','F','O')),
    phone        VARCHAR(15),
    address      VARCHAR(150),
    blood_group  VARCHAR(3)
                 CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'))
);


CREATE TABLE room (
    room_no       VARCHAR(10) PRIMARY KEY,
    room_type     VARCHAR(20) NOT NULL
                  CHECK (room_type IN ('General','Semi-Private','Private','ICU','CCU')),
    daily_charge  NUMERIC(10,2) NOT NULL CHECK (daily_charge > 0),
    status        VARCHAR(12) NOT NULL DEFAULT 'Available'
                  CHECK (status IN ('Available','Occupied','Maintenance'))
);


CREATE TABLE medicine (
    med_id      SERIAL PRIMARY KEY,
    name        VARCHAR(80) NOT NULL,
    unit_price  NUMERIC(8,2) NOT NULL CHECK (unit_price >= 0),
    stock_qty   INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0)
);


CREATE TABLE lab_test (
    test_id    SERIAL PRIMARY KEY,
    test_name  VARCHAR(80) NOT NULL UNIQUE,
    cost       NUMERIC(10,2) NOT NULL CHECK (cost >= 0)
);


CREATE TABLE doctor_schedule (
    schedule_id    SERIAL PRIMARY KEY,
    doctor_id      INT NOT NULL
                   REFERENCES doctor(doctor_id)
                   ON UPDATE CASCADE ON DELETE CASCADE,
    day_of_week    VARCHAR(9) NOT NULL
                   CHECK (day_of_week IN ('Saturday','Sunday','Monday','Tuesday',
                                          'Wednesday','Thursday','Friday')),
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    chamber_no     VARCHAR(10),
    slot_duration  INT NOT NULL DEFAULT 15 CHECK (slot_duration > 0),
    max_patients   INT NOT NULL DEFAULT 20 CHECK (max_patients > 0),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT chk_sched_time  CHECK (end_time > start_time),
    -- same doctor cannot have two schedules starting at the same time on a day
    CONSTRAINT uq_doc_day_slot UNIQUE (doctor_id, day_of_week, start_time)
);


CREATE TABLE appointment (
    appt_id      SERIAL PRIMARY KEY,
    patient_id   INT NOT NULL
                 REFERENCES patient(patient_id)
                 ON UPDATE CASCADE ON DELETE CASCADE,
    doctor_id    INT NOT NULL
                 REFERENCES doctor(doctor_id)
                 ON UPDATE CASCADE ON DELETE RESTRICT,
    schedule_id  INT
                 REFERENCES doctor_schedule(schedule_id)
                 ON UPDATE CASCADE ON DELETE SET NULL,
    appt_date    DATE NOT NULL,
    time_slot    TIME NOT NULL,
    status       VARCHAR(12) NOT NULL DEFAULT 'Scheduled'
                 CHECK (status IN ('Scheduled','Completed','Cancelled','No-Show')),

    CONSTRAINT uq_doc_slot UNIQUE (doctor_id, appt_date, time_slot)
);



CREATE TABLE prescription (
    presc_id    SERIAL PRIMARY KEY,
    appt_id     INT NOT NULL UNIQUE          
                REFERENCES appointment(appt_id)
                ON UPDATE CASCADE ON DELETE CASCADE,
    presc_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnosis   VARCHAR(255)
);



CREATE TABLE presc_medicine (
    presc_id   INT NOT NULL
               REFERENCES prescription(presc_id)
               ON UPDATE CASCADE ON DELETE CASCADE,
    med_id     INT NOT NULL
               REFERENCES medicine(med_id)
               ON UPDATE CASCADE ON DELETE RESTRICT,
    dosage     VARCHAR(40) NOT NULL,        
    frequency  VARCHAR(40) NOT NULL,     
    duration   VARCHAR(40) NOT NULL,      

    PRIMARY KEY (presc_id, med_id)
);



CREATE TABLE patient_test (
    patient_id  INT NOT NULL
                REFERENCES patient(patient_id)
                ON UPDATE CASCADE ON DELETE CASCADE,
    test_id     INT NOT NULL
                REFERENCES lab_test(test_id)
                ON UPDATE CASCADE ON DELETE RESTRICT,
    test_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    result      TEXT,
    doctor_id   INT                    
                REFERENCES doctor(doctor_id)
                ON UPDATE CASCADE ON DELETE SET NULL,

    PRIMARY KEY (patient_id, test_id, test_date)
);


CREATE TABLE admission (
    admission_id    SERIAL PRIMARY KEY,
    patient_id      INT NOT NULL
                    REFERENCES patient(patient_id)
                    ON UPDATE CASCADE ON DELETE CASCADE,
    room_no         VARCHAR(10) NOT NULL
                    REFERENCES room(room_no)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    admit_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    discharge_date  DATE,

    CONSTRAINT chk_discharge CHECK (discharge_date IS NULL
                                    OR discharge_date >= admit_date)
);

CREATE UNIQUE INDEX uq_room_active
    ON admission(room_no)
    WHERE discharge_date IS NULL;


CREATE TABLE bill (
    bill_id       SERIAL PRIMARY KEY,
    patient_id    INT NOT NULL
                  REFERENCES patient(patient_id)
                  ON UPDATE CASCADE ON DELETE RESTRICT,
    admission_id  INT                       
                  REFERENCES admission(admission_id)
                  ON UPDATE CASCADE ON DELETE SET NULL,
    issue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0
                  CHECK (total_amount >= 0),
    pay_status    VARCHAR(10) NOT NULL DEFAULT 'Unpaid'
                  CHECK (pay_status IN ('Unpaid','Partial','Paid'))
);



CREATE TABLE bill_item (
    bill_id      INT NOT NULL
                 REFERENCES bill(bill_id)
                 ON UPDATE CASCADE ON DELETE CASCADE,
    item_no      INT NOT NULL,
    description  VARCHAR(120) NOT NULL,
    amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),

    PRIMARY KEY (bill_id, item_no)
);



CREATE TABLE payment (
    payment_id   SERIAL PRIMARY KEY,
    bill_id      INT NOT NULL
                 REFERENCES bill(bill_id)
                 ON UPDATE CASCADE ON DELETE CASCADE,
    pay_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    method       VARCHAR(15) NOT NULL
                 CHECK (method IN ('Cash','Card','bKash','Nagad','Bank')),
    paid_amount  NUMERIC(10,2) NOT NULL CHECK (paid_amount > 0)
);

CREATE INDEX idx_appt_date     ON appointment(appt_date);
CREATE INDEX idx_appt_patient  ON appointment(patient_id);
CREATE INDEX idx_doctor_dept   ON doctor(dept_id);
CREATE INDEX idx_bill_patient  ON bill(patient_id);
CREATE INDEX idx_payment_bill  ON payment(bill_id);
