
-- Demo password for seeded accounts: Pass@123
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;
-- Login credentials and role ownership links.
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

    -- Patient and doctor accounts must link to exactly one owner record.
    CONSTRAINT chk_role_link CHECK (
        (role = 'patient'      AND patient_id IS NOT NULL AND doctor_id IS NULL) OR
        (role = 'doctor'       AND doctor_id  IS NOT NULL AND patient_id IS NULL) OR
        (role IN ('admin','receptionist') AND patient_id IS NULL AND doctor_id IS NULL)
    ),

    CONSTRAINT uq_user_patient UNIQUE (patient_id),
    CONSTRAINT uq_user_doctor  UNIQUE (doctor_id)
);

CREATE INDEX idx_user_email ON app_user(email);
CREATE INDEX idx_user_role  ON app_user(role);
-- Stored sessions allow logout to invalidate the token server-side.
CREATE TABLE auth_sessions (
    session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     INT NOT NULL
                REFERENCES app_user(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_session_user ON auth_sessions(user_id);
-- Seed accounts for local development.
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

INSERT INTO app_user (email, password_hash, full_name, role, doctor_id) VALUES
('anika.tasnim@healthflow.com',   '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr.Anika Tasnim','doctor', 11);
INSERT INTO app_user (email, password_hash, full_name, role, doctor_id) VALUES
('nasrin.sultana@healthflow.com',   '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Nasrin Sultana',    'doctor', 2),
('farhana.yasmin@healthflow.com',   '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Farhana Yasmin',    'doctor', 4),
('tanvir.ahmed@healthflow.com',     '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Tanvir Ahmed',      'doctor', 5),
('shirin.akter@healthflow.com',     '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Shirin Akter',      'doctor', 6),
('mahbubur.rahman@healthflow.com',  '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Mahbubur Rahman',   'doctor', 7),
('rokeya.begum@healthflow.com',     '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Rokeya Begum',      'doctor', 8),
('kamrul.hasan@healthflow.com',     '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Kamrul Hasan',      'doctor', 9),
('sabrina.chowdhury@healthflow.com','$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O', 'Dr. Sabrina Chowdhury', 'doctor', 10);