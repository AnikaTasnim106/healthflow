-- ============================================================
-- HealthFlow: Hospital Management System
-- PostgreSQL Schema
-- ============================================================

-- Run with: psql -U your_user -d healthflow -f schema_postgres.sql

-- ------------------------------------------------------------
-- 1. Department
-- ------------------------------------------------------------
CREATE TABLE Department (
    Dept_ID     SERIAL PRIMARY KEY,
    Dept_Name   VARCHAR(100) NOT NULL,
    Location    VARCHAR(100)
);

-- ------------------------------------------------------------
-- 2. Doctor (belongs_to -> Department)
-- ------------------------------------------------------------
CREATE TABLE Doctor (
    Doctor_ID       SERIAL PRIMARY KEY,
    Name            VARCHAR(100) NOT NULL,
    Specialization  VARCHAR(100),
    Phone           VARCHAR(20),
    Consult_Fee     DECIMAL(10,2),
    Dept_ID         INT REFERENCES Department(Dept_ID)
);

-- ------------------------------------------------------------
-- 3. Doctor_Schedule (has -> Doctor)
-- ------------------------------------------------------------
CREATE TABLE Doctor_Schedule (
    Schedule_ID     SERIAL PRIMARY KEY,
    Day_of_week     VARCHAR(20) NOT NULL,
    Start_time      TIME NOT NULL,
    End_time        TIME NOT NULL,
    Slot_duration   INT,
    Max_patients    INT,
    Chamber_no      VARCHAR(20),
    is_Active       BOOLEAN DEFAULT TRUE,
    Doctor_ID       INT NOT NULL REFERENCES Doctor(Doctor_ID)
);

-- ------------------------------------------------------------
-- 4. Patient
-- ------------------------------------------------------------
CREATE TABLE Patient (
    Patient_ID   SERIAL PRIMARY KEY,
    Name         VARCHAR(100) NOT NULL,
    Address      VARCHAR(200),
    DOB          DATE,
    Gender       VARCHAR(10) CHECK (Gender IN ('Male','Female','Other')),
    Blood_Group  VARCHAR(5),
    Phone        VARCHAR(20)
);

-- ------------------------------------------------------------
-- 5. Appointment (books -> Patient, contains -> Doctor_Schedule)
-- ------------------------------------------------------------
CREATE TABLE Appointment (
    Appt_ID      SERIAL PRIMARY KEY,
    Appt_Date    DATE NOT NULL,
    Time_Slot    TIME,
    Status       VARCHAR(20) DEFAULT 'Scheduled' CHECK (Status IN ('Scheduled','Completed','Cancelled')),
    Patient_ID   INT NOT NULL REFERENCES Patient(Patient_ID),
    Schedule_ID  INT NOT NULL REFERENCES Doctor_Schedule(Schedule_ID)
);

-- ------------------------------------------------------------
-- 6. Medicine
-- ------------------------------------------------------------
CREATE TABLE Medicine (
    Med_ID      SERIAL PRIMARY KEY,
    Name        VARCHAR(100) NOT NULL,
    Unit_price  DECIMAL(10,2),
    Stock_Qty   INT DEFAULT 0
);

-- ------------------------------------------------------------
-- 7. Prescription (results_in <- Appointment)
-- ------------------------------------------------------------
CREATE TABLE Prescription (
    Presc_ID     SERIAL PRIMARY KEY,
    Diagnosis    VARCHAR(255),
    Presc_Date   DATE NOT NULL,
    Appt_ID      INT NOT NULL REFERENCES Appointment(Appt_ID)
);

-- ------------------------------------------------------------
-- 8. Prescription_Medicine (junction table, M:N "includes")
-- ------------------------------------------------------------
CREATE TABLE Prescription_Medicine (
    Presc_ID   INT REFERENCES Prescription(Presc_ID),
    Med_ID     INT REFERENCES Medicine(Med_ID),
    Dosage     VARCHAR(50),
    Duration   VARCHAR(50),
    Frequency  VARCHAR(50),
    PRIMARY KEY (Presc_ID, Med_ID)
);

-- ------------------------------------------------------------
-- 9. Lab_Test (suggests <- Doctor, undergoes <- Patient)
-- ------------------------------------------------------------
CREATE TABLE Lab_Test (
    Test_ID     SERIAL PRIMARY KEY,
    Test_Name   VARCHAR(100) NOT NULL,
    Cost        DECIMAL(10,2),
    Test_date   DATE,
    Result      VARCHAR(255),
    Doctor_ID   INT NOT NULL REFERENCES Doctor(Doctor_ID),
    Patient_ID  INT NOT NULL REFERENCES Patient(Patient_ID)
);

-- ------------------------------------------------------------
-- 10. Room
-- ------------------------------------------------------------
CREATE TABLE Room (
    Room_No       INT PRIMARY KEY,
    Room_type     VARCHAR(50),
    Daily_Charge  DECIMAL(10,2),
    Status        VARCHAR(20) DEFAULT 'Available' CHECK (Status IN ('Available','Occupied','Maintenance'))
);

-- ------------------------------------------------------------
-- 11. Admission (admitted <- Patient, occupies -> Room)
-- ------------------------------------------------------------
CREATE TABLE Admission (
    Admission_ID     SERIAL PRIMARY KEY,
    Admit_Date       DATE NOT NULL,
    Discharge_Date   DATE,
    Patient_ID       INT NOT NULL REFERENCES Patient(Patient_ID),
    Room_No          INT NOT NULL REFERENCES Room(Room_No)
);

-- ------------------------------------------------------------
-- 12. Bill (generates <- Admission)
-- ------------------------------------------------------------
CREATE TABLE Bill (
    Bill_ID        SERIAL PRIMARY KEY,
    Issue_Date     DATE NOT NULL,
    Total_Amount   DECIMAL(10,2) DEFAULT 0,
    Pay_Status     VARCHAR(20) DEFAULT 'Unpaid' CHECK (Pay_Status IN ('Paid','Unpaid','Partial')),
    Admission_ID   INT REFERENCES Admission(Admission_ID)
);

-- ------------------------------------------------------------
-- 13. Bill_Item (weak entity, "has" <- Bill)
-- ------------------------------------------------------------
CREATE TABLE Bill_Item (
    Bill_ID      INT REFERENCES Bill(Bill_ID) ON DELETE CASCADE,
    Item_No      INT,
    Description  VARCHAR(255),
    Amount       DECIMAL(10,2),
    PRIMARY KEY (Bill_ID, Item_No)
);

-- ------------------------------------------------------------
-- 14. Payment (pays -> Bill)
-- ------------------------------------------------------------
CREATE TABLE Payment (
    Payment_ID   SERIAL PRIMARY KEY,
    Date         DATE NOT NULL,
    Method       VARCHAR(50),
    Paid_Amount  DECIMAL(10,2),
    Bill_ID      INT NOT NULL REFERENCES Bill(Bill_ID)
);
