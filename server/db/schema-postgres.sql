-- ============================================================
--  UI Sports Academy 2026 Summer Camp - PostgreSQL Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS applicants (
  id              SERIAL PRIMARY KEY,
  form_number     VARCHAR(30) UNIQUE,

  surname         TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  middle_name     TEXT,
  date_of_birth   DATE NOT NULL,
  age             INTEGER,
  gender          TEXT NOT NULL CHECK (gender IN ('Male','Female')),
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

  last_avg_score  NUMERIC(5,2),
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
  group_assigned  TEXT,
  room_number     TEXT,
  coach_assigned  TEXT,

  ip_address      TEXT,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id                  SERIAL PRIMARY KEY,
  applicant_id        INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  amount_paid         NUMERIC(10,2) NOT NULL,
  fee_type            TEXT DEFAULT 'Regular' CHECK (fee_type IN ('Regular','Early Bird')),
  discount_pct        NUMERIC(5,2) DEFAULT 0,
  gross_amount        NUMERIC(10,2) NOT NULL DEFAULT 230000,
  transaction_ref     TEXT,
  receipt_amount      NUMERIC(10,2),
  receipt_transaction_ref TEXT,
  ocr_extracted_at    TIMESTAMPTZ,
  bank_name           TEXT DEFAULT 'Access Bank',
  account_number      TEXT DEFAULT '1805832892',
  payment_date        DATE,
  receipt_path        TEXT,
  verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending','Verified','Rejected')),
  verified_by         INTEGER,
  verified_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'verifier' CHECK (role IN ('super_admin','admin','verifier')),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   INTEGER,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL PRIMARY KEY,
  applicant_id  INTEGER REFERENCES applicants(id) ON DELETE CASCADE,
  type          TEXT DEFAULT 'email' CHECK (type IN ('email','sms')),
  subject       TEXT,
  message       TEXT,
  sent_at       TIMESTAMPTZ,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_applicants_timestamp') THEN
    CREATE TRIGGER update_applicants_timestamp
    BEFORE UPDATE ON applicants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_timestamp') THEN
    CREATE TRIGGER update_payments_timestamp
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_settings_timestamp') THEN
    CREATE TRIGGER update_app_settings_timestamp
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS receipt_transaction_ref TEXT,
  ADD COLUMN IF NOT EXISTS ocr_extracted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_form_number_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.form_number IS NULL OR LENGTH(TRIM(NEW.form_number)) = 0 THEN
    UPDATE applicants
    SET form_number = 'UI/SA/2026/' || LPAD(NEW.id::TEXT, 4, '0')
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_form_number') THEN
    CREATE TRIGGER set_form_number
    AFTER INSERT ON applicants
    FOR EACH ROW EXECUTE FUNCTION set_form_number_fn();
  END IF;
END $$;

INSERT INTO app_settings (setting_key, setting_value)
VALUES
  ('auto_accept_mode', 'balanced'),
  ('camp_fee_amount', '230000'),
  ('early_bird_enabled', '1'),
  ('early_bird_discount_pct', '10'),
  ('early_bird_fee_amount', ''),
  ('early_bird_deadline', '2026-07-03')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO admin_users (name, username, email, password_hash, role)
VALUES (
  'System Admin',
  'Admin',
  'admin@uisportsacademy.ng',
  '$2b$12$JQOLIZPWp7bHEkcMXnBZLe6ufBR2hTgDi2az8.TBRjb6pJyjihknG',
  'super_admin'
)
ON CONFLICT (username) DO NOTHING;
