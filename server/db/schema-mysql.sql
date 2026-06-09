-- ============================================================
--  UI Sports Academy 2026 Summer Camp - MySQL Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS applicants (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  form_number     VARCHAR(30) UNIQUE,

  surname         TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  middle_name     TEXT,
  date_of_birth   DATE NOT NULL,
  age             INT,
  gender          TEXT NOT NULL,
  nationality     TEXT,
  state_of_origin TEXT,
  lga             TEXT,
  school          TEXT,
  class_level     TEXT,
  home_address    TEXT,
  city            TEXT,
  state           TEXT,

  age_category    TEXT NOT NULL CHECK (age_category IN ('Junior (6-17)','Elite (18-23)')),
  sport_selection TEXT NOT NULL,
  experience_level TEXT CHECK (experience_level IN ('Beginner','Intermediate','Advanced')),
  previous_clinic  TEXT DEFAULT 'None' CHECK (previous_clinic IN ('UI Sports Clinic','Other','None')),
  previous_clinic_other TEXT,
  tshirt_size     TEXT CHECK (tshirt_size IN ('Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL','Adult XXL')),

  guardian_title  TEXT,
  guardian_name   TEXT NOT NULL,
  guardian_relationship TEXT CHECK (guardian_relationship IN ('Father','Mother','Guardian','Sponsor')),
  guardian_phone  TEXT NOT NULL,
  guardian_whatsapp TEXT,
  guardian_email  TEXT NOT NULL,
  guardian_occupation TEXT,
  guardian_office_address TEXT,
  emergency_name  TEXT,
  emergency_phone TEXT,
  emergency_relationship TEXT,

  last_avg_score  DECIMAL(5,2),
  class_position  TEXT,
  best_subject    TEXT,
  favourite_subject TEXT,
  academic_goal   TEXT,

  blood_group     TEXT,
  genotype        TEXT CHECK (genotype IN ('AA','AS','SS','AC','SC')),
  condition_asthma      BOOLEAN DEFAULT FALSE,
  condition_epilepsy    BOOLEAN DEFAULT FALSE,
  condition_diabetes    BOOLEAN DEFAULT FALSE,
  condition_hypertension BOOLEAN DEFAULT FALSE,
  condition_heart       BOOLEAN DEFAULT FALSE,
  allergies       TEXT,
  current_medications TEXT,
  past_injuries   TEXT,
  on_medication   BOOLEAN DEFAULT FALSE,
  medication_detail TEXT,
  physical_disability BOOLEAN DEFAULT FALSE,
  disability_detail TEXT,
  last_medical_checkup DATE,
  family_doctor   TEXT,
  family_doctor_phone TEXT,

  consent_medical   BOOLEAN DEFAULT FALSE,
  consent_conduct   BOOLEAN DEFAULT FALSE,
  consent_media     BOOLEAN DEFAULT FALSE,
  consent_indemnity BOOLEAN DEFAULT FALSE,

  passport_photo   TEXT,
  birth_certificate TEXT,
  school_result    TEXT,

  status          TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Payment Submitted','Payment Verified','Medical Cleared','Admitted','Rejected')),
  id_card_generated BOOLEAN DEFAULT FALSE,
  id_card_generated_at DATETIME,
  group_assigned  TEXT,
  room_number     TEXT,
  coach_assigned  TEXT,

  ip_address      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id        INT NOT NULL,
  amount_paid         DECIMAL(10,2) NOT NULL,
  fee_type            TEXT DEFAULT 'Regular' CHECK (fee_type IN ('Regular','Early Bird')),
  discount_pct        DECIMAL(5,2) DEFAULT 0,
  gross_amount        DECIMAL(10,2) NOT NULL DEFAULT 230000,
  transaction_ref     TEXT,
  receipt_amount      DECIMAL(10,2),
  receipt_transaction_ref TEXT,
  ocr_extracted_at    DATETIME,
  bank_name           TEXT DEFAULT 'Access Bank',
  account_number      TEXT DEFAULT '1805832892',
  payment_date        DATE,
  receipt_path        TEXT,
  verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending','Verified','Rejected')),
  verified_by         INT,
  verified_at         DATETIME,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          TEXT NOT NULL,
  username      VARCHAR(100) UNIQUE,
  email         VARCHAR(255) UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'verifier' CHECK (role IN ('super_admin','admin','verifier')),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   INT,
  old_value   JSON,
  new_value   JSON,
  ip_address  TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id  INT,
  type          TEXT DEFAULT 'email' CHECK (type IN ('email','sms')),
  subject       TEXT,
  message       TEXT,
  sent_at       DATETIME,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(255) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value, updated_at)
VALUES
  ('auto_accept_mode', 'balanced', CURRENT_TIMESTAMP),
  ('camp_fee_amount', '230000', CURRENT_TIMESTAMP),
  ('early_bird_enabled', '1', CURRENT_TIMESTAMP),
  ('early_bird_discount_pct', '10', CURRENT_TIMESTAMP),
  ('early_bird_fee_amount', '', CURRENT_TIMESTAMP),
  ('early_bird_deadline', '2026-07-03', CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value),
  updated_at = CURRENT_TIMESTAMP;

INSERT IGNORE INTO admin_users (name, username, email, password_hash, role)
VALUES (
  'System Admin',
  'Admin',
  'admin@uisportsacademy.ng',
  '$2b$12$JQOLIZPWp7bHEkcMXnBZLe6ufBR2hTgDi2az8.TBRjb6pJyjihknG',
  'super_admin'
);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS receipt_transaction_ref TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_at DATETIME;

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS id_card_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS id_card_generated_at DATETIME;

UPDATE applicants
SET id_card_generated = TRUE,
    id_card_generated_at = COALESCE(id_card_generated_at, CURRENT_TIMESTAMP)
WHERE status IN ('Admitted', 'Payment Verified', 'Medical Cleared')
  AND COALESCE(id_card_generated, FALSE) = FALSE;
