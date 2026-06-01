-- ============================================================
--  UI Sports Academy 2026 Summer Camp - Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS uisa_camp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE uisa_camp;

-- ──────────────────────────────────────────────
--  APPLICANTS (core registration table)
-- ──────────────────────────────────────────────
CREATE TABLE applicants (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  form_number     VARCHAR(30) UNIQUE,           -- generated: UI/SA/2026/0001

  -- Section A: Personal
  surname         VARCHAR(100) NOT NULL,
  first_name      VARCHAR(100) NOT NULL,
  middle_name     VARCHAR(100),
  date_of_birth   DATE NOT NULL,
  age             INT GENERATED ALWAYS AS (TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) STORED,
  gender          ENUM('Male','Female') NOT NULL,
  nationality     VARCHAR(80),
  state_of_origin VARCHAR(80),
  lga             VARCHAR(80),
  school          VARCHAR(200),
  class_level     VARCHAR(80),
  home_address    TEXT,
  city            VARCHAR(100),
  state           VARCHAR(100),

  -- Section B: Sport
  age_category    ENUM('Junior (6-17)','Elite (18-23)') NOT NULL,
  sport_selection VARCHAR(50) NOT NULL,          -- Football / Basketball / Athletics / Swimming / Tennis
  experience_level ENUM('Beginner','Intermediate','Advanced'),
  previous_clinic  ENUM('UI Sports Clinic','Other','None') DEFAULT 'None',
  previous_clinic_other VARCHAR(100),
  tshirt_size     ENUM('Youth M','Youth L','Adult S','Adult M','Adult L','Adult XL','Adult XXL'),

  -- Section C: Parent/Guardian
  guardian_title  VARCHAR(20),
  guardian_name   VARCHAR(200) NOT NULL,
  guardian_relationship ENUM('Father','Mother','Guardian','Sponsor'),
  guardian_phone  VARCHAR(30) NOT NULL,
  guardian_whatsapp VARCHAR(30),
  guardian_email  VARCHAR(150) NOT NULL,
  guardian_occupation VARCHAR(150),
  guardian_office_address TEXT,
  emergency_name  VARCHAR(200),
  emergency_phone VARCHAR(30),
  emergency_relationship VARCHAR(80),

  -- Section D: Academic
  last_avg_score  DECIMAL(5,2),
  class_position  VARCHAR(20),
  best_subject    VARCHAR(100),
  favourite_subject VARCHAR(100),
  academic_goal   TEXT,

  -- Section E: Medical
  blood_group     VARCHAR(5),
  genotype        ENUM('AA','AS','SS','AC','SC'),
  condition_asthma     TINYINT(1) DEFAULT 0,
  condition_epilepsy   TINYINT(1) DEFAULT 0,
  condition_diabetes   TINYINT(1) DEFAULT 0,
  condition_hypertension TINYINT(1) DEFAULT 0,
  condition_heart      TINYINT(1) DEFAULT 0,
  allergies       TEXT,
  current_medications TEXT,
  past_injuries   TEXT,
  on_medication   TINYINT(1) DEFAULT 0,
  medication_detail TEXT,
  physical_disability TINYINT(1) DEFAULT 0,
  disability_detail TEXT,
  last_medical_checkup DATE,
  family_doctor   VARCHAR(200),
  family_doctor_phone VARCHAR(30),

  -- Section F: Consent
  consent_medical  TINYINT(1) DEFAULT 0,
  consent_conduct  TINYINT(1) DEFAULT 0,
  consent_media    TINYINT(1) DEFAULT 0,
  consent_indemnity TINYINT(1) DEFAULT 0,

  -- Attachments (file paths)
  passport_photo   VARCHAR(300),
  birth_certificate VARCHAR(300),
  school_result    VARCHAR(300),

  -- Status tracking
  status          ENUM('Pending','Payment Submitted','Payment Verified','Medical Cleared','Admitted','Rejected') DEFAULT 'Pending',
  group_assigned  VARCHAR(50),
  room_number     VARCHAR(30),
  coach_assigned  VARCHAR(200),

  ip_address      VARCHAR(45),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
--  PAYMENTS
-- ──────────────────────────────────────────────
CREATE TABLE payments (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id        INT NOT NULL,
  amount_paid         DECIMAL(10,2) NOT NULL,
  fee_type            ENUM('Regular','Early Bird') DEFAULT 'Regular',
  discount_pct        DECIMAL(5,2) DEFAULT 0,
  gross_amount        DECIMAL(10,2) NOT NULL DEFAULT 230000,
  transaction_ref     VARCHAR(100),             -- narration used by applicant
  bank_name           VARCHAR(100) DEFAULT 'Access Bank',
  account_number      VARCHAR(30) DEFAULT '1805832892',
  payment_date        DATE,
  receipt_path        VARCHAR(300),             -- uploaded receipt file
  verification_status ENUM('Pending','Verified','Rejected') DEFAULT 'Pending',
  verified_by         INT,                      -- admin user id
  verified_at         TIMESTAMP,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────
--  ADMIN USERS
-- ──────────────────────────────────────────────
CREATE TABLE admin_users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role        ENUM('super_admin','admin','verifier') DEFAULT 'verifier',
  is_active   TINYINT(1) DEFAULT 1,
  last_login  TIMESTAMP,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
--  AUDIT LOG
-- ──────────────────────────────────────────────
CREATE TABLE audit_log (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT,
  action      VARCHAR(100) NOT NULL,
  table_name  VARCHAR(80),
  record_id   INT,
  old_value   JSON,
  new_value   JSON,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────
--  NOTIFICATIONS
-- ──────────────────────────────────────────────
CREATE TABLE notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  applicant_id  INT,
  type          ENUM('email','sms') DEFAULT 'email',
  subject       VARCHAR(200),
  message       TEXT,
  sent_at       TIMESTAMP,
  status        ENUM('pending','sent','failed') DEFAULT 'pending',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────
--  APP SETTINGS
-- ──────────────────────────────────────────────
CREATE TABLE app_settings (
  setting_key   VARCHAR(120) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('auto_accept_mode', 'balanced')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('camp_fee_amount', '230000')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('early_bird_enabled', '1')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('early_bird_discount_pct', '10')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('early_bird_fee_amount', '')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('early_bird_deadline', '2026-07-03')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ──────────────────────────────────────────────
--  TRIGGERS & STORED PROCEDURES
-- ──────────────────────────────────────────────

DELIMITER $$

-- Auto-generate form number on insert
CREATE TRIGGER set_form_number
BEFORE INSERT ON applicants
FOR EACH ROW
BEGIN
  DECLARE next_id INT;
  SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM applicants;
  SET NEW.form_number = CONCAT('UI/SA/2026/', LPAD(next_id, 4, '0'));
END$$

DELIMITER ;

-- ──────────────────────────────────────────────
--  SEED: default super admin
-- ──────────────────────────────────────────────
-- Password: Admin@2026 (bcrypt hash, change in production)
INSERT INTO admin_users (name, email, password_hash, role)
VALUES (
  'System Admin',
  'admin@uisportsacademy.ng',
  '$2b$12$xfb.7pSdDz1i7nlkQXhXme80DweKnUhL93UdNiej99oJ5h5zzAOwa',
  'super_admin'
);
