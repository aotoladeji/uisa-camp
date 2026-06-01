const express = require('express');
const { body, query, validationResult } = require('express-validator');
const fs      = require('fs');
const path    = require('path');
const pool    = require('../db/pool');
const upload  = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../middleware/email');
const { getPricingConfig } = require('../utils/pricing');

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const isTrueValue = (value) => {
  if (value === true || value === 1) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
};

const shouldAutoAcceptApplication = (data, category, mode = 'balanced') => {
  const hasCoreProfile = Boolean(
    data.first_name &&
    data.surname &&
    data.date_of_birth &&
    data.gender &&
    data.sport_selection &&
    data.guardian_name &&
    data.guardian_email &&
    data.guardian_phone
  );

  const hasRequiredConsents = isTrueValue(data.consent_medical)
    && isTrueValue(data.consent_conduct)
    && isTrueValue(data.consent_indemnity);

  const hasNoCriticalFlags = !isTrueValue(data.condition_epilepsy)
    && !isTrueValue(data.condition_heart)
    && !isTrueValue(data.physical_disability);

  const eliteReady = category !== 'Elite (18-23)'
    || ['Intermediate', 'Advanced'].includes(data.experience_level);

  if (mode === 'lenient') {
    return hasCoreProfile && hasRequiredConsents;
  }

  if (mode === 'strict') {
    const hasNoMedicalFlags = !isTrueValue(data.condition_asthma)
      && !isTrueValue(data.condition_epilepsy)
      && !isTrueValue(data.condition_diabetes)
      && !isTrueValue(data.condition_hypertension)
      && !isTrueValue(data.condition_heart)
      && !isTrueValue(data.physical_disability);
    const eliteStrictReady = category !== 'Elite (18-23)'
      || ['Advanced'].includes(data.experience_level);
    return hasCoreProfile && hasRequiredConsents && hasNoMedicalFlags && eliteStrictReady;
  }

  return hasCoreProfile && hasRequiredConsents && hasNoCriticalFlags && eliteReady;
};

const getAutoAcceptMode = async () => {
  const [rows] = await pool.query(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'auto_accept_mode' LIMIT 1"
  );
  return rows[0]?.setting_value || 'balanced';
};

const toCardNumber = (id) => `UIC-2026-${String(id).padStart(4, '0')}`;

const normalizeUploadPath = (filePath) => {
  if (!filePath) return null;
  return String(filePath).replace(/\\/g, '/').replace(/^\.?\//, '');
};

const safeDeleteFile = (filePath) => {
  if (!filePath) return;
  const absolutePath = path.resolve(process.cwd(), filePath);
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.warn('Could not delete file:', absolutePath, err.message);
  }
};

const parseIds = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => parseInt(v, 10))
    .filter(Number.isInteger);
};

  const getPricing = async () => getPricingConfig(pool);

// ─── POST /api/applicants  (public: submit registration) ─────────────────────
router.post('/',
  upload.fields([
    { name: 'passport_photo',   maxCount: 1 },
    { name: 'birth_certificate', maxCount: 1 },
    { name: 'school_result',    maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const d = req.body;
      const files = req.files || {};

      // Determine age category
      const dob = new Date(d.date_of_birth);
      const age = new Date().getFullYear() - dob.getFullYear();
      const category = age <= 17 ? 'Junior (6-17)' : 'Elite (18-23)';
      const autoAcceptMode = await getAutoAcceptMode();
      const autoAccepted = shouldAutoAcceptApplication(d, category, autoAcceptMode);
      const initialStatus = autoAccepted ? 'Admitted' : 'Pending';

      const [result] = await pool.query(
        `INSERT INTO applicants (
          surname, first_name, middle_name, date_of_birth, gender,
          nationality, state_of_origin, lga, school, class_level,
          home_address, city, state,
          age_category, sport_selection, experience_level,
          previous_clinic, previous_clinic_other, tshirt_size,
          guardian_title, guardian_name, guardian_relationship,
          guardian_phone, guardian_whatsapp, guardian_email,
          guardian_occupation, guardian_office_address,
          emergency_name, emergency_phone, emergency_relationship,
          last_avg_score, class_position, best_subject, favourite_subject, academic_goal,
          blood_group, genotype,
          condition_asthma, condition_epilepsy, condition_diabetes,
          condition_hypertension, condition_heart,
          allergies, current_medications, past_injuries,
          on_medication, medication_detail,
          physical_disability, disability_detail,
          last_medical_checkup, family_doctor, family_doctor_phone,
          consent_medical, consent_conduct, consent_media, consent_indemnity,
          passport_photo, birth_certificate, school_result,
          status,
          ip_address
        ) VALUES (
          ?,?,?,?, ?,
          ?,?,?,?, ?,
          ?,?, ?,
          ?,?, ?,
          ?,?, ?,
          ?,?, ?,
          ?,?, ?,
          ?, ?,
          ?,?, ?,
          ?,?,?,?, ?,
          ?, ?,
          ?,?, ?,
          ?, ?,
          ?,?, ?,
          ?, ?,
          ?, ?,
          ?,?, ?,
          ?,?,?,?,
          ?,?, ?,
          ?, ?
        )`,
        [
          d.surname, d.first_name, d.middle_name || null, d.date_of_birth, d.gender,
          d.nationality || null, d.state_of_origin || null, d.lga || null, d.school || null, d.class_level || null,
          d.home_address || null, d.city || null, d.state || null,
          category, d.sport_selection, d.experience_level || null,
          d.previous_clinic || 'None', d.previous_clinic_other || null, d.tshirt_size || null,
          d.guardian_title || null, d.guardian_name, d.guardian_relationship || null,
          d.guardian_phone, d.guardian_whatsapp || null, d.guardian_email,
          d.guardian_occupation || null, d.guardian_office_address || null,
          d.emergency_name || null, d.emergency_phone || null, d.emergency_relationship || null,
          d.last_avg_score || null, d.class_position || null, d.best_subject || null, d.favourite_subject || null, d.academic_goal || null,
          d.blood_group || null, d.genotype || null,
          isTrueValue(d.condition_asthma), isTrueValue(d.condition_epilepsy), isTrueValue(d.condition_diabetes),
          isTrueValue(d.condition_hypertension), isTrueValue(d.condition_heart),
          d.allergies || null, d.current_medications || null, d.past_injuries || null,
          isTrueValue(d.on_medication), d.medication_detail || null,
          isTrueValue(d.physical_disability), d.disability_detail || null,
          d.last_medical_checkup || null, d.family_doctor || null, d.family_doctor_phone || null,
          isTrueValue(d.consent_medical), isTrueValue(d.consent_conduct),
          isTrueValue(d.consent_media), isTrueValue(d.consent_indemnity),
          files.passport_photo?.[0]?.path || null,
          files.birth_certificate?.[0]?.path || null,
          files.school_result?.[0]?.path || null,
          initialStatus,
          req.ip
        ]
      );

      const applicantId = result.insertId;

      // Keep explicit form number assignment for deterministic response payload.
      const formNumber = `UI/SA/2026/${String(applicantId).padStart(4, '0')}`;
      await pool.query('UPDATE applicants SET form_number = ? WHERE id = ?', [formNumber, applicantId]);

      // Calculate fee
      const pricing = await getPricing();
      const earlyBird = pricing.early_bird_active;
      const amount = earlyBird ? pricing.computed_early_bird_fee : pricing.regular_fee;

      res.status(201).json({
        success: true,
        applicant_id: applicantId,
        form_number: formNumber,
        fee: amount,
        early_bird: earlyBird,
        pricing,
        auto_accepted: autoAccepted,
        auto_accept_mode: autoAcceptMode,
        status: initialStatus,
        message: 'Registration successful. Check your email for payment instructions.'
      });

      // Send confirmation email after response so user does not wait on SMTP latency.
      setImmediate(async () => {
        try {
          await sendEmail(d.guardian_email, 'registration_received', {
            form_number: formNumber,
            full_name: `${d.first_name} ${d.surname}`,
            guardian_name: d.guardian_name,
            sport: d.sport_selection,
            category,
            amount,
            early_bird: earlyBird,
          });
        } catch (emailErr) {
          console.log('Email send skipped:', emailErr.message);
        }
      });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
  }
);

// ─── GET /api/applicants/lookup  (public: check status by form_number + email) ──
router.get('/pricing', async (_req, res) => {
  const pricing = await getPricing();
  res.json({ pricing });
});

// ─── GET /api/applicants/lookup  (public: check status by email + phone) ──
router.get('/lookup', async (req, res) => {
  const { email, phone } = req.query;
  if (!email || !phone) return res.status(400).json({ error: 'email and phone required' });

  const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
  const requestedPhone = normalizePhone(phone);

  const [rows] = await pool.query(`
    SELECT a.id, a.form_number, a.surname, a.first_name, a.age_category,
           a.sport_selection, a.status, a.guardian_email, a.guardian_phone,
           p.verification_status AS payment_status, p.amount_paid,
           a.created_at
    FROM applicants a
    LEFT JOIN payments p ON p.applicant_id = a.id
    WHERE LOWER(TRIM(a.guardian_email)) = LOWER(TRIM(?))
    ORDER BY a.created_at DESC, a.id DESC`,
    [email]
  );

  const match = rows.find((row) => {
    const storedPhone = normalizePhone(row.guardian_phone);
    return storedPhone === requestedPhone || storedPhone.endsWith(requestedPhone) || requestedPhone.endsWith(storedPhone);
  });

  if (!match) return res.status(404).json({ error: 'Application not found' });
  res.json(match);
});

// ─── GET /api/applicants  (admin: list all) ───────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const { status, sport, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';

  if (status) { where += ' AND a.status = ?'; params.push(status); }
  if (sport)  { where += ' AND a.sport_selection = ?'; params.push(sport); }
  if (search) {
    where += ' AND (a.surname LIKE ? OR a.first_name LIKE ? OR a.form_number LIKE ? OR a.guardian_email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const [listRows] = await pool.query(`
    SELECT a.id, a.form_number, a.surname, a.first_name, a.gender,
           a.age, a.age_category, a.sport_selection, a.status,
           a.guardian_name, a.guardian_email, a.guardian_phone,
           p.verification_status AS payment_status, p.amount_paid,
           a.created_at
    FROM applicants a
    LEFT JOIN payments p ON p.applicant_id = a.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const [countRows] = await pool.query(`
    SELECT COUNT(*) AS total FROM applicants a ${where}`, params
  );
  const total = countRows[0].total;

  res.json({ data: listRows, total, page: parseInt(page), limit: parseInt(limit) });
});

// ─── GET /api/applicants/id-cards  (admin: admitted applicants) ─────────────
router.get('/id-cards', authenticate, async (req, res) => {
  const { ids } = req.query;
  const params = ['Admitted'];
  let where = 'WHERE a.status = ?';

  if (ids) {
    const parsedIds = String(ids)
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(Number.isInteger);

    if (parsedIds.length) {
      where += ` AND a.id IN (${parsedIds.map(() => '?').join(',')})`;
      params.push(...parsedIds);
    }
  }

  const [rows] = await pool.query(`
    SELECT
      a.id,
      a.form_number,
      a.first_name,
      a.middle_name,
      a.surname,
      a.date_of_birth,
      a.blood_group,
      a.guardian_phone,
      a.guardian_email,
      a.sport_selection,
      a.age_category,
      a.group_assigned,
      a.room_number,
      a.passport_photo,
      a.created_at
    FROM applicants a
    ${where}
    ORDER BY a.created_at DESC
  `, params);

  const data = rows.map((row) => ({
    ...row,
    passport_photo: normalizeUploadPath(row.passport_photo),
    full_name: `${row.first_name} ${row.middle_name || ''} ${row.surname}`.replace(/\s+/g, ' ').trim(),
    card_number: toCardNumber(row.id),
    card_role: row.sport_selection,
    group_assigned: row.group_assigned,
    room_number: row.room_number,
    barcode_value: row.form_number || toCardNumber(row.id),
  }));

  res.json({ data, total: data.length });
});

// ─── POST /api/applicants/bulk-delete  (admin) ──────────────────────────────
router.post('/bulk-delete', authenticate, requireRole('admin','super_admin'), async (req, res) => {
  const ids = parseIds(req.body.ids);
  if (!ids.length) {
    return res.status(400).json({ error: 'ids must be a non-empty array of applicant IDs' });
  }

  const [rows] = await pool.query(
    `SELECT id, form_number, first_name, surname, passport_photo, birth_certificate, school_result
     FROM applicants
     WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'No matching applicants found' });
  }

  await pool.query(
    `DELETE FROM applicants WHERE id IN (${rows.map(() => '?').join(',')})`,
    rows.map(r => r.id)
  );

  rows.forEach((row) => {
    safeDeleteFile(row.passport_photo);
    safeDeleteFile(row.birth_certificate);
    safeDeleteFile(row.school_result);
  });

  await pool.query(
    'INSERT INTO audit_log (admin_id, action, table_name, record_id, new_value) VALUES (?,?,?,?,?)',
    [
      req.admin.id,
      'bulk_delete_applicants',
      'applicants',
      null,
      JSON.stringify({
        count: rows.length,
        ids: rows.map(r => r.id),
        forms: rows.map(r => r.form_number),
      }),
    ]
  );

  res.json({ success: true, deleted: rows.length, ids: rows.map(r => r.id) });
});

// ─── GET /api/applicants/:id  (admin) ────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT a.*, p.id AS payment_id, p.amount_paid, p.fee_type, p.discount_pct,
           p.transaction_ref, p.receipt_amount, p.receipt_transaction_ref,
           p.payment_date, p.receipt_path,
           p.verification_status, p.verified_at, p.rejection_reason
    FROM applicants a
    LEFT JOIN payments p ON p.applicant_id = a.id
    WHERE a.id = ?`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ─── PATCH /api/applicants/:id/status  (admin) ────────────────────────────────
router.patch('/:id/status', authenticate, requireRole('admin','super_admin'), async (req, res) => {
  const { status, group_assigned, room_number, coach_assigned } = req.body;
  const allowed = ['Pending','Payment Submitted','Payment Verified','Medical Cleared','Admitted','Rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  await pool.query(`
    UPDATE applicants SET status = ?,
      group_assigned  = COALESCE(?, group_assigned),
      room_number     = COALESCE(?, room_number),
      coach_assigned  = COALESCE(?, coach_assigned)
    WHERE id = ?`,
    [status, group_assigned||null, room_number||null, coach_assigned||null, req.params.id]
  );

  // Audit log
  await pool.query(
    'INSERT INTO audit_log (admin_id, action, table_name, record_id, new_value) VALUES (?,?,?,?,?)',
    [req.admin.id, 'status_change', 'applicants', req.params.id, JSON.stringify({ status })]
  );

  // Send appropriate email
  const [applRows] = await pool.query(
    'SELECT *, CONCAT(first_name, \' \', surname) AS full_name FROM applicants WHERE id = ?',
    [req.params.id]
  );
  const appl = applRows[0];
  const templateMap = { Admitted: 'admitted', Rejected: 'rejected' };
  if (templateMap[status]) {
    await sendEmail(appl.guardian_email, templateMap[status], {
      form_number: appl.form_number,
      full_name: appl.full_name,
      guardian_name: appl.guardian_name,
      sport: appl.sport_selection,
      group: group_assigned, room: room_number, coach: coach_assigned,
      reason: req.body.rejection_reason,
    });
  }

  const idCard = status === 'Admitted'
    ? {
        applicant_id: appl.id,
        card_number: toCardNumber(appl.id),
        full_name: appl.full_name,
        card_role: appl.sport_selection,
        group_assigned: appl.group_assigned,
        room_number: appl.room_number,
        barcode_value: appl.form_number || toCardNumber(appl.id),
      }
    : null;

  res.json({ success: true, id_card: idCard });
});

// ─── DELETE /api/applicants/:id  (admin) ──────────────────────────────────────
router.delete('/:id', authenticate, requireRole('admin','super_admin'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, form_number, first_name, surname, passport_photo, birth_certificate, school_result FROM applicants WHERE id = ?',
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Applicant not found' });
  }

  const applicant = rows[0];

  await pool.query('DELETE FROM applicants WHERE id = ?', [req.params.id]);

  safeDeleteFile(applicant.passport_photo);
  safeDeleteFile(applicant.birth_certificate);
  safeDeleteFile(applicant.school_result);

  await pool.query(
    'INSERT INTO audit_log (admin_id, action, table_name, record_id, new_value) VALUES (?,?,?,?,?)',
    [
      req.admin.id,
      'delete_applicant',
      'applicants',
      req.params.id,
      JSON.stringify({
        form_number: applicant.form_number,
        full_name: `${applicant.first_name} ${applicant.surname}`,
      }),
    ]
  );

  res.json({ success: true });
});

// ─── GET /api/applicants/stats/summary  (admin dashboard) ─────────────────────
router.get('/stats/summary', authenticate, async (req, res) => {
  const [counts] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='Payment Submitted' THEN 1 ELSE 0 END) AS payment_submitted,
      SUM(CASE WHEN status='Payment Verified' THEN 1 ELSE 0 END) AS payment_verified,
      SUM(CASE WHEN status='Medical Cleared' THEN 1 ELSE 0 END) AS medical_cleared,
      SUM(CASE WHEN status='Admitted' THEN 1 ELSE 0 END) AS admitted,
      SUM(CASE WHEN status='Rejected' THEN 1 ELSE 0 END) AS rejected
    FROM applicants`
  );
  const [sportBreakdown] = await pool.query(`
    SELECT sport_selection, COUNT(*) AS count FROM applicants GROUP BY sport_selection`
  );
  const [categoryBreakdown] = await pool.query(`
    SELECT age_category, COUNT(*) AS count FROM applicants GROUP BY age_category`
  );
  const [revenue] = await pool.query(`
    SELECT COALESCE(SUM(amount_paid),0) AS total_revenue,
           COUNT(*) AS total_payments
    FROM payments WHERE verification_status = 'Verified'`
  );
  res.json({ counts: counts[0], sportBreakdown, categoryBreakdown, revenue: revenue[0] });
});

module.exports = router;
