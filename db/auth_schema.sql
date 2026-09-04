
DROP TABLE IF EXISTS app_user CASCADE;


CREATE TABLE app_user (
    user_id       SERIAL PRIMARY KEY,

    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,      
    full_name     VARCHAR(80)  NOT NULL,

    role          VARCHAR(15)  NOT NULL
                  CHECK (role IN ('admin','receptionist','doctor','patient')),
    patient_id    INT REFERENCES patient(patient_id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
    doctor_id     INT REFERENCES doctor(doctor_id)
                  ON UPDATE CASCADE ON DELETE CASCADE,

    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_role_link CHECK (
        (role = 'patient'      AND patient_id IS NOT NULL AND doctor_id IS NULL) OR
        (role = 'doctor'       AND doctor_id  IS NOT NULL AND patient_id IS NULL) OR
        (role IN ('admin','receptionist') AND patient_id IS NULL AND doctor_id IS NULL)
    ),

INSERT INTO app_user (email, password_hash, full_name, role, patient_id, doctor_id) VALUES

('admin@healthflow.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'System Administrator', 'admin', NULL, NULL),

('reception@healthflow.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Front Desk', 'receptionist', NULL, NULL),
('rezaul.karim@healthflow.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Dr. Rezaul Karim', 'doctor', NULL, 1),

('aminul.haque@healthflow.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Dr. Aminul Haque', 'doctor', NULL, 3),

('rahim.uddin@mail.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Rahim Uddin', 'patient', 1, NULL),

('fatema.khatun@mail.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Fatema Khatun', 'patient', 2, NULL);
