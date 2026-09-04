-- ============================================================
--  HealthFlow — Authentication & Authorization schema
--  Run AFTER schema.sql and seed.sql
--
--  Sob account er password: Pass@123
-- ============================================================

-- pgcrypto age lagbe — auth_sessions e gen_random_uuid() use hoy
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS auth_sessions CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;


-- ------------------------------------------------------------
--  app_user — login credentials + role
--
--  role DATABASE e store hoy ar login er somoy EKHAN THEKE pora
--  hoy. Client kokhono role pathay na.
--
--  patient_id / doctor_id: ekta account kon patient ba kon doctor
--  er. Ei link tai object-level ownership check possible kore.
-- ------------------------------------------------------------

CREATE TABLE app_user (
    user_id       SERIAL PRIMARY KEY,

    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,      -- bcrypt hash, plain text KOKHONO na
    full_name     VARCHAR(80)  NOT NULL,

    role          VARCHAR(15)  NOT NULL
                  CHECK (role IN ('admin','receptionist','doctor','patient')),

    patient_id    INT REFERENCES patient(patient_id)
                  ON UPDATE CASCADE ON DELETE CASCADE,
    doctor_id     INT REFERENCES doctor(doctor_id)
                  ON UPDATE CASCADE ON DELETE CASCADE,

    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- patient role hole patient_id lagbe, doctor hole doctor_id.
    -- admin/receptionist er duitai NULL.
    CONSTRAINT chk_role_link CHECK (
        (role = 'patient'      AND patient_id IS NOT NULL AND doctor_id IS NULL) OR
        (role = 'doctor'       AND doctor_id  IS NOT NULL AND patient_id IS NULL) OR
        (role IN ('admin','receptionist') AND patient_id IS NULL AND doctor_id IS NULL)
    ),

    -- ek patient er ekta-i account, ek doctor er ekta-i account
    CONSTRAINT uq_user_patient UNIQUE (patient_id),
    CONSTRAINT uq_user_doctor  UNIQUE (doctor_id)
);

CREATE INDEX idx_user_email ON app_user(email);
CREATE INDEX idx_user_role  ON app_user(role);


-- ------------------------------------------------------------
--  auth_sessions — logout ke SOTTIKARER invalidate korar jonno
--
--  JWT normally stateless — logout korleo purano token kaj kore.
--  Tai token er sathe ekta session row DB te rakhi. Logout korle
--  oi row delete hoy, ar middleware prottek request e check kore.
--
--  Guideline 3.1: logout must "genuinely invalidate the session
--  or token — not merely a redirect on the frontend."
-- ------------------------------------------------------------

CREATE TABLE auth_sessions (
    session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     INT NOT NULL
                REFERENCES app_user(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_session_user ON auth_sessions(user_id);


-- ------------------------------------------------------------
--  Demo accounts — sob password: Pass@123
-- ------------------------------------------------------------

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

-- Ei duita diye object-level ownership demo:
-- rahim login kore /api/patients/2 chaile 403 pabe.
('rahim.uddin@mail.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Rahim Uddin', 'patient', 1, NULL),

('fatema.khatun@mail.com',
 '$2b$10$mSqcLEn5OpUgab0jby5siuG27z6vNotFBO8mtElVrh2OnRlMVW6/O',
 'Fatema Khatun', 'patient', 2, NULL);


-- ------------------------------------------------------------
--  Check
-- ------------------------------------------------------------
-- SELECT user_id, email, full_name, role, patient_id, doctor_id FROM app_user;