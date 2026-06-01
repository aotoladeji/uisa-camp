-- ============================================================
--  UI Sports Academy 2026 Summer Camp - SQLite Schema
-- ============================================================

-- ──────────────────────────────────────────────
--  APPLICANTS (core registration table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applicants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  form_number     TEXT UNIQUE,

  -- Section A: Personal
  surname         TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  middle_name     TEXT,
  date_of_birth   TEXT NOT NULL,
  age             INTEGER,
  gender          TEXT NOT NULL CHECK(gender IN ('Male','Female')),
  nationality     TEXT,
  state_of_origin TEXT,
  lga             TEXT,
  school          TEXT,
  class_level     TEXT,
  home_address    TEXT,
  city            TEXT,
  state           TEXT,

  -- Section B: Sport
  age_category    TEXT NOT NULL CHECK(age_category IN ('Junior (6-17)','Elite (18-23)')),
  sport_selection TEXT NOT NULL,
  experience_level TEXT CHECK(experience_level IN ('Beginner','Intermediate','Advanced')),
  previous_clinic  TEXT DEFAULT 'None' CHECK(previous_clinic IN ('UI Sports Clinic','Other','None')),
  previous_clinic_other TEXT,
  tshirt_size     TEXT CHECK(tshirt_size IN ('Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL','Adult XXL')),

  -- Section C: Parent/Guardian
  guardian_title  TEXT,
  guardian_name   TEXT NOT NULL,
  guardian_relationship TEXT CHECK(guardian_relationship IN ('Father','Mother','Guardian','Sponsor')),
  guardian_phone  TEXT NOT NULL,
  guardian_whatsapp TEXT,
  guardian_email  TEXT NOT NULL,
  guardian_occupation TEXT,
  guardian_office_address TEXT,
  emergency_name  TEXT,
  emergency_phone TEXT,
  emergency_relationship TEXT,

  -- Section D: Academic
  last_avg_score  REAL,
  class_position  TEXT,
  best_subject    TEXT,
  favourite_subject TEXT,
  academic_goal   TEXT,

  -- Section E: Medical
  blood_group     TEXT,
  genotype        TEXT CHECK(genotype IN ('AA','AS','SS','AC','SC')),
  condition_asthma     INTEGER DEFAULT 0,
  condition_epilepsy   INTEGER DEFAULT 0,
  condition_diabetes   INTEGER DEFAULT 0,
  condition_hypertension INTEGER DEFAULT 0,
  condition_heart      INTEGER DEFAULT 0,
  allergies       TEXT,
  current_medications TEXT,
  past_injuries   TEXT,
  on_medication   INTEGER DEFAULT 0,
  medication_detail TEXT,
  physical_disability INTEGER DEFAULT 0,
  disability_detail TEXT,
  last_medical_checkup TEXT,
  family_doctor   TEXT,
  family_doctor_phone TEXT,

  -- Section F: Consent
  consent_medical  INTEGER DEFAULT 0,
  consent_conduct  INTEGER DEFAULT 0,
  consent_media    INTEGER DEFAULT 0,
  consent_indemnity INTEGER DEFAULT 0,

  -- Attachments (file paths)
  passport_photo   TEXT,
  birth_certificate TEXT,
  school_result    TEXT,

  -- Status tracking
  status          TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Payment Submitted','Payment Verified','Medical Cleared','Admitted','Rejected')),
  group_assigned  TEXT,
  room_number     TEXT,
  coach_assigned  TEXT,

  ip_address      TEXT,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
--  PAYMENTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id        INTEGER NOT NULL,
  amount_paid         REAL NOT NULL,
  fee_type            TEXT DEFAULT 'Regular' CHECK(fee_type IN ('Regular','Early Bird')),
  discount_pct        REAL DEFAULT 0,
  gross_amount        REAL NOT NULL DEFAULT 230000,
  transaction_ref     TEXT,
  bank_name           TEXT DEFAULT 'Access Bank',
  account_number      TEXT DEFAULT '1805832892',
  payment_date        TEXT,
  receipt_path        TEXT,
  verification_status TEXT DEFAULT 'Pending' CHECK(verification_status IN ('Pending','Verified','Rejected')),
  verified_by         INTEGER,
  verified_at         TEXT,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────
--  ADMIN USERS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT,
  password_hash TEXT NOT NULL,
  role        TEXT DEFAULT 'verifier' CHECK(role IN ('super_admin','admin','verifier')),
  is_active   INTEGER DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
--  AUDIT LOG
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   INTEGER,
  old_value   TEXT,
  new_value   TEXT,
  ip_address  TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────
--  NOTIFICATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id  INTEGER,
  type          TEXT DEFAULT 'email' CHECK(type IN ('email','sms')),
  subject       TEXT,
  message       TEXT,
  sent_at       TEXT,
  status        TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────
--  APP SETTINGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('auto_accept_mode', 'balanced', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('camp_fee_amount', '230000', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('early_bird_enabled', '1', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('early_bird_discount_pct', '10', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('early_bird_fee_amount', '', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
VALUES ('early_bird_deadline', '2026-07-03', CURRENT_TIMESTAMP);

-- ──────────────────────────────────────────────
--  TRIGGERS
-- ──────────────────────────────────────────────

-- Auto-generate form number on insert
CREATE TRIGGER IF NOT EXISTS set_form_number
AFTER INSERT ON applicants
WHEN NEW.form_number IS NULL
BEGIN
  UPDATE applicants 
  SET form_number = 'UI/SA/2026/' || substr('0000' || NEW.id, -4, 4)
  WHERE id = NEW.id;
END;

-- Auto-update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_applicants_timestamp
AFTER UPDATE ON applicants
BEGIN
  UPDATE applicants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_payments_timestamp
AFTER UPDATE ON payments
BEGIN
  UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ──────────────────────────────────────────────
--  SEED: default super admin
-- ──────────────────────────────────────────────
-- Username: Admin, Password: admin123 (bcrypt hash)
INSERT OR IGNORE INTO admin_users (name, username, email, password_hash, role)
VALUES (
  'System Admin',
  'Admin',
  'admin@uisportsacademy.ng',
  '$2b$12$JQOLIZPWp7bHEkcMXnBZLe6ufBR2hTgDi2az8.TBRjb6pJyjihknG',
  'super_admin'
);
