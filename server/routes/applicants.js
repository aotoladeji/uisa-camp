const express = require('express');
const { body, query, validationResult } = require('express-validator');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const pool    = require('../db/pool');
const upload  = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../middleware/email');
const { extractPaymentDetails, hasUsefulExtraction } = require('../middleware/ocr');
const { getPricingConfig } = require('../utils/pricing');
const cloudinary = require('../utils/cloudinary');

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
  const s = String(filePath);
  // If it's already a full Cloudinary URL, return as is
  if (s.startsWith('http')) return s;
  // If it's a local/memory path string that shouldn't be there, suppress it
  if (s.startsWith('memory') || s.includes('Screenshot')) return null;
  // Fallback for any legacy local uploads
  return s.replace(/\\/g, '/').replace(/^\.?\//, '');
};

const safeDeleteFile = (filePath) => {
  if (!filePath) return;
  // If we have a http link, don't try to delete local file
  if (filePath.startsWith('http')) return;
  
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

      // Passport photo is required
      if (!files.passport_photo?.[0]) {
        return res.status(400).json({ error: 'Passport photo is required' });
      }

      // Determine age category
      const dob = new Date(d.date_of_birth);
      const age = new Date().getFullYear() - dob.getFullYear();
      const category = age <= 17 ? 'Junior (6-17)' : 'Elite (18-23)';
      const autoAcceptMode = await getAutoAcceptMode();
      const autoAccepted = shouldAutoAcceptApplication(d, category, autoAcceptMode);
      // Auto-accepted applicants get provisional admission immediately; others await admin review.
      const initialStatus = autoAccepted ? 'Admitted' : 'Pending';

      const [result] = await pool.query(
        `INSERT INTO applicants (
          surname, first_name, middle_name, date_of_birth, gender,
          nationality, state_of_origin, lga, school, class_level,
          home_address, city, state,
          age, age_category, sport_selection, experience_level,
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
          ?,?,?, ?,
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
          age, category, d.sport_selection, d.experience_level || null,
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
          null, // passport_photo
          null, // birth_certificate
          null, // school_result
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

      const paymentUrl = `/payment?form_number=${encodeURIComponent(formNumber)}&email=${encodeURIComponent(d.guardian_email || '')}`;

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
        can_proceed_to_payment: !!autoAccepted,
        payment_url: paymentUrl,
        message: 'Registration successful. Check your email for payment instructions.'
      });

      // Process file uploads to Cloudinary after response
      setImmediate(async () => {
        try {
          const studentName = `${d.surname}_${d.first_name}`.replace(/\s+/g, '_');
          const cleanForm = formNumber.replace(/\//g, '_');

          const fileTasks = [
            { field: 'passport_photo',   folder: 'photos',    prefix: 'Passport' },
            { field: 'birth_certificate', folder: 'documents', prefix: 'BirthCert' },
            { field: 'school_result',    folder: 'documents', prefix: 'Result' }
          ];

          for (const task of fileTasks) {
            const file = files[task.field]?.[0];
            if (file) {
              const fileData = file.buffer || file.path;
              if (fileData) {
                const publicId = `${task.prefix}_${cleanForm}_${studentName}`;
                const secureUrl = await cloudinary.uploadToCloudinary(fileData, `uisa/applicants/${task.folder}`, publicId);
                
                if (secureUrl) {
                  await pool.query(
                    `UPDATE applicants SET ${task.field} = ? WHERE id = ?`,
                    [secureUrl, applicantId]
                  );
                }
              }
            }
          }
        } catch (warnErr) {
          console.warn('Background task warning:', warnErr.message);
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
           a.is_payment_verified, a.is_medical_cleared, a.is_admitted,
           p.verification_status AS payment_status, p.amount_paid,
           a.created_at
    FROM applicants a
    LEFT JOIN payments p ON p.applicant_id = a.id
    WHERE LOWER(TRIM(a.guardian_email)) = LOWER(TRIM(?))
    ORDER BY a.created_at ASC, a.id ASC`,
    [email]
  );

  // Filter by phone match (normalized, handles leading-zero differences)
  const matches = rows.filter((row) => {
    const storedPhone = normalizePhone(row.guardian_phone);
    return storedPhone === requestedPhone
      || storedPhone.endsWith(requestedPhone)
      || requestedPhone.endsWith(storedPhone);
  });

  if (!matches.length) return res.status(404).json({ error: 'Application not found. Check your email and phone number.' });

  // Return array so a parent with multiple kids gets all results
  res.json(matches);
});

// ─── GET /api/applicants/lookup-by-form  (public: find by form_number + email) ─
router.get('/lookup-by-form', async (req, res) => {
  const { form_number, guardian_email } = req.query;
  if (!form_number || !guardian_email) {
    return res.status(400).json({ error: 'form_number and guardian_email are required' });
  }
  const [rows] = await pool.query(`
    SELECT a.id, a.form_number, a.surname, a.first_name, a.age_category,
           a.sport_selection, a.status, a.guardian_email, a.guardian_phone,
           p.verification_status AS payment_status, p.amount_paid,
           a.created_at
    FROM applicants a
    LEFT JOIN payments p ON p.applicant_id = a.id
    WHERE LOWER(TRIM(a.form_number))    = LOWER(TRIM(?))
      AND LOWER(TRIM(a.guardian_email)) = LOWER(TRIM(?))
    LIMIT 1`,
    [form_number, guardian_email]
  );
  if (!rows.length) {
    return res.status(404).json({ error: 'Application not found. Check your form number and email address.' });
  }
  res.json(rows[0]);
});

// ─── GET /api/applicants/lookup-guardian  (public: autofill by name + phone) ──
// Returns the most recent application matching the guardian name + phone so the
// registration form can pre-populate fields for a returning parent.
router.get('/lookup-guardian', async (req, res) => {
  const { name, phone } = req.query;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });

  const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
  const requestedPhone = normalizePhone(phone);
  const nameLower = String(name).trim().toLowerCase();

  const [rows] = await pool.query(`
    SELECT * FROM applicants
    WHERE LOWER(TRIM(guardian_name)) LIKE ?
    ORDER BY created_at DESC, id DESC
    LIMIT 20`,
    [`%${nameLower}%`]
  );

  const match = rows.find((row) => {
    const storedPhone = normalizePhone(row.guardian_phone);
    return storedPhone === requestedPhone
      || storedPhone.endsWith(requestedPhone)
      || requestedPhone.endsWith(storedPhone);
  });

  if (!match) return res.status(404).json({ error: 'No existing application found' });
  res.json(match);
});
router.get('/', authenticate, async (req, res) => {
  const { status, sport, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';

  if (status) {
    if (status === 'Medical Cleared') {
      where += ' AND a.is_medical_cleared = 1';
    } else if (status === 'Admitted') {
      where += ' AND a.is_admitted = 1';
    } else if (status === 'Payment Verified') {
      where += ' AND a.is_payment_verified = 1';
    } else {
      where += ' AND a.status = ?';
      params.push(status);
    }
  }
  if (sport)  { where += ' AND a.sport_selection = ?'; params.push(sport); }
  if (search) {
    where += ' AND (a.surname LIKE ? OR a.first_name LIKE ? OR a.form_number LIKE ? OR a.guardian_email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const [listRows] = await pool.query(`
    SELECT a.id, a.form_number, a.surname, a.first_name, a.gender,
           a.age, a.age_category, a.sport_selection, a.status,
           a.is_medical_cleared, a.is_admitted, a.is_payment_verified,
           a.guardian_name, a.guardian_email, a.guardian_phone,
           p.verification_status AS payment_status, p.amount_paid,
           (CASE WHEN a.passport_photo IS NOT NULL AND a.passport_photo != '' THEN 1 ELSE 0 END) AS has_photo,
           (CASE WHEN p.receipt_path IS NOT NULL AND p.receipt_path != '' THEN 1 ELSE 0 END) AS has_receipt,
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
  const params = [];
  let where = "WHERE (a.is_admitted = 1 OR COALESCE(a.id_card_generated, FALSE) = TRUE)";

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
      a.id_card_generated,
      a.id_card_generated_at,
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

// ─── GET /api/applicants/stats/summary  (admin dashboard) ─────────────────────
// IMPORTANT: must be defined BEFORE /:id route or Express will match 'stats' as an id
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const [countsRows] = await pool.query(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'payment submitted' THEN 1 ELSE 0 END) AS payment_submitted,
        SUM(CASE WHEN is_payment_verified = 1 THEN 1 ELSE 0 END) AS payment_verified,
        SUM(CASE WHEN is_medical_cleared = 1 THEN 1 ELSE 0 END) AS medical_cleared,
        SUM(CASE WHEN is_admitted = 1 THEN 1 ELSE 0 END) AS admitted,
        SUM(CASE WHEN LOWER(TRIM(status)) = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM applicants`
    );

    const counts = countsRows[0] || {};
    const [sportBreakdown] = await pool.query(`SELECT sport_selection, COUNT(*) AS count FROM applicants GROUP BY sport_selection`);
    const [categoryBreakdown] = await pool.query(`SELECT age_category, COUNT(*) AS count
      FROM applicants
      WHERE age_category IS NOT NULL AND age_category != ''
      GROUP BY age_category`);

    const [revRows] = await pool.query(`SELECT 
        SUM(amount_paid) AS total_revenue,
        COUNT(*) AS total_payments
      FROM payments 
      WHERE verification_status = 'Verified' OR verification_status = 'verified'`);
    
    const revenue = revRows[0] || {};

    res.json({ 
      counts: counts, 
      sportBreakdown: sportBreakdown || [], 
      categoryBreakdown: categoryBreakdown || [], 
      revenue: {
        total_revenue: revenue.total_revenue || 0,
        total_payments: revenue.total_payments || 0
      }
    });
  } catch (err) {
    console.error('Stats error DETAILED:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats', details: err.message });
  }
});

// ─── GET /api/applicants/letter  (public: view/download admission letter) ──
router.get('/letter', async (req, res) => {
  const { form, sig, format } = req.query;
  if (!form || !sig) {
    return res.status(400).send('<html><body style="font-family:sans-serif;padding:40px"><p>Invalid link.</p></body></html>');
  }

  const secret = process.env.JWT_SECRET || 'uisa_dev_secret';
  const expectedSig = crypto.createHmac('sha256', secret).update(form).digest('hex');
  if (sig !== expectedSig) {
    return res.status(403).send('<html><body style="font-family:sans-serif;padding:40px"><p>This link is invalid. Please contact the camp office.</p></body></html>');
  }

  try {
    const [rows] = await pool.query(`
      SELECT a.first_name, a.middle_name, a.surname, a.form_number,
             a.sport_selection, a.age_category,
             a.guardian_name, a.group_assigned, a.room_number, a.coach_assigned
      FROM applicants a
      WHERE LOWER(TRIM(a.form_number)) = LOWER(TRIM(?))
      LIMIT 1`, [form]);

    if (!rows.length) {
      return res.status(404).send('<html><body style="font-family:sans-serif;padding:40px"><p>Application not found.</p></body></html>');
    }

    const a     = rows[0];
    const fullName = [a.first_name, a.middle_name, a.surname].filter(Boolean).join(' ');
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // If format=pdf, generate PDF directly
    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({
        size: 'A4',
        margin: 56,
        info: {
          Title:   `Admission Letter – ${a.form_number}`,
          Author:  'University of Ibadan Sports Academy',
          Subject: '2026 Summer Sports Camp – Official Admission',
        },
      });

      const filename = `Admission-Letter-${(a.form_number || form).replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      doc.pipe(res);

      const navy = '#0A3D62';
      const lm   = 56;
      const w    = doc.page.width - lm * 2;  // ≈ 483

      // ── HEADER ────────────────────────────────────────────────────────────
      doc.fontSize(16).fillColor(navy).font('Helvetica-Bold')
         .text('UNIVERSITY OF IBADAN SPORTS ACADEMY', lm, 56, { width: w, align: 'center' });
      doc.fontSize(11).fillColor('#334155').font('Helvetica')
         .text('Official Admission Offer  \u00b7  2026 Summer Sports Camp', { width: w, align: 'center' });
      doc.moveDown(0.5);
      const ruleY = doc.y;
      doc.moveTo(lm, ruleY).lineTo(lm + w, ruleY).lineWidth(2).strokeColor(navy).stroke();
      doc.moveDown(1.4);

      // ── TITLE + SALUTATION ────────────────────────────────────────────────
      doc.fontSize(18).fillColor(navy).font('Helvetica-Bold')
         .text('Offer of Official Admission', { width: w });
      doc.moveDown(0.8);

      doc.fontSize(12).fillColor('#111827');
      doc.font('Helvetica').text('Date:  ', { continued: true })
         .font('Helvetica-Bold').text(today, { width: w });
      doc.moveDown(0.3);
      doc.font('Helvetica').text('Dear ', { continued: true })
         .font('Helvetica-Bold').text(`${a.guardian_name || 'Parent/Guardian'},`, { width: w });
      doc.moveDown(0.7);

      // ── BODY PARAGRAPHS ───────────────────────────────────────────────────
      doc.font('Helvetica').fontSize(12).lineGap(3).fillColor('#111827');
      doc.text('We are pleased to inform you that ', { continued: true })
         .font('Helvetica-Bold').text(fullName, { continued: true })
         .font('Helvetica').text(' has been officially admitted into the University of Ibadan Sports Academy 2026 Summer Sports Camp.', { width: w });
      doc.moveDown(0.4);
      doc.text('This admission follows the successful review of the application, verification of payment, and approval of all submitted documentation.', { width: w });
      doc.moveDown(1);

      // ── INFO TABLE ────────────────────────────────────────────────────────
      const tableRows = [
        ['Applicant Name',  fullName],
        ['Form Number',     a.form_number],
        ['Sport',           a.sport_selection  || '\u2014'],
        ['Category',        a.age_category     || '\u2014'],
        ['Training Group',  a.group_assigned   || 'TBA'],
        ['Assigned Coach',  a.coach_assigned   || 'TBA'],
        ['Accommodation',   a.room_number      || 'TBA'],
        ['Camp Period',     'August 3 \u2013 August 28, 2026'],
        ['Resumption',      'Monday, August 3, 2026  \u00b7  7:00 AM \u2013 9:00 AM'],
        ['Venue',           'International School, University of Ibadan'],
      ];

      const rowH   = 24;
      const labelW = 190;
      let ty = doc.y;

      // outer border
      doc.rect(lm, ty, w, rowH * tableRows.length)
         .lineWidth(1).strokeColor('#D1D5DB').stroke();

      tableRows.forEach(([label, value], i) => {
        const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(lm, ty, w, rowH).fillColor(bg).fill();
        if (i > 0) {
          doc.moveTo(lm, ty).lineTo(lm + w, ty)
             .lineWidth(0.5).strokeColor('#E5E7EB').stroke();
        }
        doc.moveTo(lm + labelW, ty).lineTo(lm + labelW, ty + rowH)
           .lineWidth(0.5).strokeColor('#E5E7EB').stroke();
        doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10)
           .text(label, lm + 8, ty + 7, { width: labelW - 16, lineBreak: false });
        doc.fillColor('#111827').font('Helvetica').fontSize(10)
           .text(value, lm + labelW + 8, ty + 7, { width: w - labelW - 16, lineBreak: false });
        ty += rowH;
      });

      // advance cursor past the table
      doc.text('', lm, ty + 18);

      // ── CLOSING ───────────────────────────────────────────────────────────
      doc.font('Helvetica').fontSize(12).lineGap(3).fillColor('#111827');
      doc.text('Kindly present this letter along with proof of payment and all required documents on arrival.', { width: w });
      doc.moveDown(0.4);
      doc.text('We look forward to welcoming ', { continued: true })
         .font('Helvetica-Bold').text(fullName, { continued: true })
         .font('Helvetica').text(' to an exciting month of sports, learning and personal development.', { width: w });
      doc.moveDown(0.4);
      doc.font('Helvetica-Oblique').fillColor(navy)
         .text('Developing Champions in Sports and Character.', { width: w });
      doc.moveDown(2.5);

      // ── SIGNATURE ─────────────────────────────────────────────────────────
      const sigY = doc.y;
      doc.moveTo(lm, sigY).lineTo(lm + 200, sigY)
         .lineWidth(1).strokeColor('#111827').stroke();
      doc.moveDown(0.5);
      doc.font('Helvetica').fillColor('#374151').fontSize(11)
         .text('Camp Director', { width: w })
         .text('University of Ibadan Sports Academy', { width: w });

      // ── FOOTER ────────────────────────────────────────────────────────────
      doc.fontSize(9).fillColor('#9CA3AF')
         .text(
           '\u00a9 2026 University of Ibadan Sports Academy  \u00b7  Ibadan, Nigeria  \u00b7  +234 803 687 0535',
           lm, doc.page.height - 46,
           { width: w, align: 'center', lineBreak: false }
         );

      doc.end();
      return;
    }

    // Otherwise, serve HTML page with download button
    const downloadUrl = `/api/applicants/letter?form=${encodeURIComponent(form)}&sig=${sig}&format=pdf`;
    const htmlPage = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Official Admission Offer - ${a.form_number}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; margin: 0; background: #f4f7f9; color: #111827; }
    .page { max-width: 720px; margin: 30px auto; background: #fff; border: 1px solid #e1e8ed; border-radius: 8px; overflow: hidden; }
    .header { background: #0A3D62; padding: 28px 36px; }
    .header-org { color: #fff; font-family: Arial, sans-serif; font-weight: 800; font-size: 20px; }
    .header-sub { color: rgba(255,255,255,0.7); font-family: Arial, sans-serif; font-size: 13px; margin-top: 4px; }
    .body { padding: 36px; }
    h1 { font-family: Arial, sans-serif; color: #0A3D62; font-size: 22px; margin: 0 0 20px; }
    h2 { font-family: Arial, sans-serif; color: #0A3D62; font-size: 16px; margin: 24px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    p { font-size: 15px; line-height: 1.7; margin: 0 0 14px; }
    .info { margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    .row { display: table; width: 100%; border-bottom: 1px solid #e5e7eb; }
    .row:last-child { border-bottom: 0; }
    .lbl { display: table-cell; width: 45%; padding: 10px 14px; background: #f9fafb; font-family: Arial, sans-serif; font-weight: 700; font-size: 13px; color: #374151; }
    .val { display: table-cell; padding: 10px 14px; font-family: Arial, sans-serif; font-size: 13px; color: #111827; }
    .badge-green { display: inline-block; background: #f0fff4; color: #16a34a; font-weight: 700; padding: 2px 10px; border-radius: 9999px; font-size: 12px; }
    .checklist { margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.8; }
    .sign { margin-top: 36px; border-top: 1px solid #d1d5db; padding-top: 10px; font-family: Arial, sans-serif; font-size: 14px; color: #374151; }
    .footer { padding: 16px 36px; text-align: center; color: #9ca3af; font-family: Arial, sans-serif; font-size: 12px; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .btn-wrap { text-align: center; margin: 28px 0 8px; }
    .btn { display: inline-block; background: #0A3D62; color: #fff; font-family: Arial, sans-serif; font-weight: 700; font-size: 14px; padding: 12px 32px; border-radius: 6px; text-decoration: none; cursor: pointer; letter-spacing: .3px; border: none; }
    .btn:hover { background: #0c4e7a; }
    .btn-secondary { background: #fff; color: #0A3D62; border: 2px solid #0A3D62; margin-left: 10px; }
    .btn-secondary:hover { background: #f0f4f8; }
    @media print {
      body { background: #fff; }
      .page { margin: 0; border: none; border-radius: 0; box-shadow: none; }
      .btn-wrap { display: none; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-org">UNIVERSITY OF IBADAN SPORTS ACADEMY</div>
      <div class="header-sub">Official Admission Offer · 2026 Summer Sports Camp</div>
    </div>
    <div class="body">
      <h1>Congratulations! Admission Offered 🏆</h1>
      <p>Dear <strong>${a.guardian_name}</strong>,</p>
      <p>We are delighted to inform you that <strong>${fullName}</strong> has been offered admission into the 2026 University of Ibadan Sports Academy Summer Camp.</p>
      <p>Following the successful review of the application and verification of all required documentation, the applicant has been selected to participate in this year's camp programme. This admission reflects our confidence in the applicant's potential and our commitment to supporting the development of young athletes in both sports performance and character.</p>

      <div class="info">
        <div class="row"><div class="lbl">Form Number</div><div class="val">${a.form_number}</div></div>
        <div class="row"><div class="lbl">Participant</div><div class="val">${fullName}</div></div>
        <div class="row"><div class="lbl">Sport</div><div class="val">${a.sport_selection || '—'}</div></div>
        <div class="row"><div class="lbl">Camp Period</div><div class="val">August 3 – Aug 28, 2026</div></div>
        <div class="row"><div class="lbl">Venue</div><div class="val">International School, Univ. of Ibadan</div></div>
        <div class="row"><div class="lbl">Training Group</div><div class="val">${a.group_assigned || 'TBA'}</div></div>
        <div class="row"><div class="lbl">Assigned Coach</div><div class="val">${a.coach_assigned || 'TBA'}</div></div>
        <div class="row"><div class="lbl">Accommodation</div><div class="val">${a.room_number || 'TBA'}</div></div>
        <div class="row"><div class="lbl">Admission Status</div><div class="val"><span class="badge-green">Admitted</span></div></div>
      </div>

      <h2>Arrival Information</h2>
      <p>Participants are expected to arrive on <strong>Monday, August 3, 2026</strong> between 7:00 AM and 9:00 AM for registration, orientation, and camp allocation.</p>

      <div class="info">
        <div class="row"><div class="lbl" colspan="2" style="width:100%;font-size:13px;font-weight:700;">Please come along with:</div></div>
        <div class="row"><div class="val" style="padding:10px 14px;">
          <ul class="checklist">
            <li>Printed official admission letter</li>
            <li>Proof of payment</li>
            <li>Medical information (if applicable)</li>
            <li>Any sport-specific equipment required</li>
          </ul>
        </div></div>
      </div>

      <h2>Important Notice</h2>
      <p>This admission is valid for the 2026 Summer Camp session only. Participants are expected to comply with all camp rules, safety regulations, and the code of conduct throughout the programme.</p>
      <p>We look forward to welcoming <strong>${fullName}</strong> to an exciting month of learning, competition, teamwork, discipline, and personal development.</p>
      <p style="font-style:italic;color:#0A3D62;font-weight:700;">Developing Champions in Sports and Character.</p>

      <div class="sign">Camp Director</div>

      <div class="btn-wrap">
        <a href="${downloadUrl}" class="btn" download>⬇ Download as PDF</a>
        <button onclick="window.print()" class="btn btn-secondary">🖨 Print Letter</button>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2026 University of Ibadan Sports Academy</p>
      <p>Ibadan, Nigeria | +234 803 687 0535</p>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlPage);

  } catch (err) {
    console.error('Letter error:', err);
    if (!res.headersSent) {
      res.status(500).send('<html><body style="font-family:sans-serif;padding:40px"><p>An error occurred. Please try again later.</p></body></html>');
    }
  }
});

// ─── GET /api/applicants/:id  (admin) ────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT a.*, p.id AS payment_id, p.amount_paid, p.fee_type, p.discount_pct,
           p.transaction_ref, p.receipt_amount, p.receipt_transaction_ref,
           p.payment_date, p.receipt_path,
           p.verification_status, p.verification_status AS payment_status,
           p.verified_at, p.rejection_reason
    FROM applicants a
    LEFT JOIN payments p ON p.applicant_id = a.id
    WHERE a.id = ?`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  
  const row = rows[0];
  row.passport_photo    = normalizeUploadPath(row.passport_photo);
  row.birth_certificate = normalizeUploadPath(row.birth_certificate);
  row.school_result     = normalizeUploadPath(row.school_result);
  row.receipt_path      = normalizeUploadPath(row.receipt_path);
  
  res.json(row);
});

// ─── PATCH /api/applicants/:id  (admin: update applicant info) ───────────────
router.patch('/:id',
  authenticate,
  requireRole('admin', 'super_admin'),
  upload.fields([
    { name: 'passport_photo',    maxCount: 1 },
    { name: 'birth_certificate', maxCount: 1 },
    { name: 'school_result',     maxCount: 1 },
    { name: 'receipt',           maxCount: 1 },
  ]),
  async (req, res) => {
    // Exclude file fields from auto-update as they are handled by Cloudinary logic below
    const fileFields = ['passport_photo', 'birth_certificate', 'school_result', 'receipt'];
    const fields = [
      'surname', 'first_name', 'middle_name', 'date_of_birth', 'gender',
      'nationality', 'state_of_origin', 'lga', 'school', 'class_level',
      'home_address', 'city', 'state', 'age', 'age_category',
      'sport_selection', 'experience_level', 'tshirt_size',
      'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_whatsapp',
      'blood_group', 'genotype', 'allergies', 'current_medications',
      'group_assigned', 'room_number', 'coach_assigned',
      'is_medical_cleared', 'is_admitted', 'is_payment_verified', 'status'
    ];

    const updates = [];
    const params = [];
    const files = req.files || {};

    fields.forEach(f => {
      // Skip if it's a file field or if value is missing
      if (req.body[f] !== undefined && !fileFields.includes(f)) {
        updates.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    });

    // Automatically recalculate age and category if DOB changes
    if (req.body.date_of_birth) {
      const dob = new Date(req.body.date_of_birth);
      if (!isNaN(dob.getTime())) {
        const age = new Date().getFullYear() - dob.getFullYear();
        const category = age <= 17 ? 'Junior (6-17)' : 'Elite (18-23)';
        
        if (!req.body.age) {
          updates.push(`age = ?`);
          params.push(age);
        }
        if (!req.body.age_category) {
          updates.push(`age_category = ?`);
          params.push(category);
        }
      }
    }

    if (updates.length === 0 && Object.keys(files).length === 0) {
      return res.status(400).json({ error: 'No fields or files to update' });
    }

    try {
      if (updates.length > 0) {
        params.push(req.params.id);
        await pool.query(
          `UPDATE applicants SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      // Handle file uploads in background
      if (Object.keys(files).length > 0) {
        const [rows] = await pool.query("SELECT first_name, surname, form_number FROM applicants WHERE id = ?", [req.params.id]);
        const appl = rows[0] || {};
        
        setImmediate(async () => {
          try {
            const studentName = `${appl.surname || 'Manual'}_${appl.first_name || 'Student'}`.replace(/\s+/g, '_');
            const cleanForm = (appl.form_number || req.params.id).toString().replace(/\//g, '_');

            // 1. Handle Applicant Documents (Passport, BirthCert, Result)
            const docTasks = [
              { field: 'passport_photo',    folder: 'photos',    prefix: 'Passport' },
              { field: 'birth_certificate',  folder: 'documents', prefix: 'BirthCert' },
              { field: 'school_result',     folder: 'documents', prefix: 'Result' }
            ];

            for (const task of docTasks) {
              const file = files[task.field]?.[0];
              if (file) {
                const fileData = file.buffer || file.path;
                if (fileData) {
                  const publicId = `${task.prefix}_${cleanForm}_${studentName}_${Date.now()}`;
                  const secureUrl = await cloudinary.uploadToCloudinary(fileData, `uisa/applicants/${task.folder}`, publicId);
                  if (secureUrl) {
                    await pool.query(`UPDATE applicants SET ${task.field} = ? WHERE id = ?`, [secureUrl, req.params.id]);
                  }
                }
              }
            }

            // 2. Handle Receipt Upload & OCR
            const receiptFile = files.receipt?.[0];
            if (receiptFile) {
              const fileData = receiptFile.buffer || receiptFile.path;
              if (fileData) {
                const publicId = `Receipt_${cleanForm}_${studentName}_${Date.now()}`;
                const secureUrl = await cloudinary.uploadToCloudinary(fileData, 'uisa/receipts', publicId);
                
                if (secureUrl) {
                  // Find existing payment or create one
                  const [pRows] = await pool.query("SELECT id FROM payments WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [req.params.id]);
                  
                  if (pRows.length) {
                    await pool.query("UPDATE payments SET receipt_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [secureUrl, pRows[0].id]);
                  } else {
                    // Create minimal entry if none exists
                    await pool.query(
                      "INSERT INTO payments (applicant_id, amount_paid, fee_type, receipt_path) VALUES (?, ?, ?, ?)",
                      [req.params.id, 0, 'Regular', secureUrl]
                    );
                  }

                  // Run OCR on the receipt - ensure buffer used if available
                  const ocrInput = receiptFile.buffer || receiptFile.path;
                  const extracted = await extractPaymentDetails(ocrInput);
                  if (extracted && hasUsefulExtraction(extracted)) {
                    console.log(`OCR extracted for applicant ${req.params.id}:`, extracted);
                    const [latestP] = await pool.query("SELECT * FROM payments WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [req.params.id]);
                    if (latestP.length) {
                      const p = latestP[0];
                      await pool.query(
                        `UPDATE payments SET 
                          transaction_ref = ?, receipt_transaction_ref = ?, 
                          receipt_amount = ?, payment_date = ?, 
                          ocr_extracted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [
                          p.transaction_ref || extracted.transaction_ref || null,
                          p.receipt_transaction_ref || extracted.transaction_ref || null,
                          p.receipt_amount || extracted.amount_paid || null,
                          p.payment_date || extracted.payment_date || null,
                          p.id
                        ]
                      );
                    }
                  }
                }
              }
            }
          } catch (bgErr) {
            console.warn('Admin edit background upload failed:', bgErr.message);
          }
        });
      }

      res.json({ success: true, message: 'Applicant update initiated' });
    } catch (err) {
      console.error('Update applicant error:', err);
      res.status(500).json({ error: 'Failed to update applicant information' });
    }
  });

// ─── PATCH /api/applicants/:id/documents  (public: reupload passport/docs) ───
// Authenticated by form_number + guardian_email — no admin token needed.
router.patch('/:id/documents',
  upload.fields([
    { name: 'passport_photo',    maxCount: 1 },
    { name: 'birth_certificate', maxCount: 1 },
    { name: 'school_result',     maxCount: 1 },
  ]),
  async (req, res) => {
    const { form_number, guardian_email } = req.body;
    if (!form_number || !guardian_email) {
      return res.status(400).json({ error: 'form_number and guardian_email are required' });
    }

    const [rows] = await pool.query(
      `SELECT id, form_number, first_name, surname, passport_photo, birth_certificate, school_result
       FROM applicants
       WHERE id = ?
         AND LOWER(TRIM(form_number))     = LOWER(TRIM(?))
         AND LOWER(TRIM(guardian_email))  = LOWER(TRIM(?))`,
      [req.params.id, form_number, guardian_email]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Application not found. Check your form number and email.' });
    }

    const appl   = rows[0];
    const files  = req.files || {};

    // We respond immediately and handle Cloudinary uploads in the background.
    // This prevents "memory:" paths from being stored in the database.
    res.json({
      success: true,
      updated: {
        passport_photo:    !!files.passport_photo?.[0],
        birth_certificate: !!files.birth_certificate?.[0],
        school_result:     !!files.school_result?.[0],
      },
    });

    // Background upload to Cloudinary
    setImmediate(async () => {
      try {
        const studentName = `${appl.surname || 'Manual'}_${appl.first_name || 'Student'}`.replace(/\s+/g, '_');
        const cleanForm = (appl.form_number || req.params.id).toString().replace(/\//g, '_');

        const tasks = [
          { field: 'passport_photo',    folder: 'photos',    prefix: 'Passport' },
          { field: 'birth_certificate',  folder: 'documents', prefix: 'BirthCert' },
          { field: 'school_result',     folder: 'documents', prefix: 'Result' }
        ];

        for (const task of tasks) {
          const file = files[task.field]?.[0];
          if (file) {
            const fileData = file.buffer || file.path;
            if (fileData) {
              const publicId = `${task.prefix}_${cleanForm}_${studentName}_${Date.now()}`;
              const secureUrl = await cloudinary.uploadToCloudinary(fileData, `uisa/applicants/${task.folder}`, publicId);
              
              if (secureUrl) {
                await pool.query(
                  `UPDATE applicants SET ${task.field} = ? WHERE id = ?`,
                  [secureUrl, req.params.id]
                );
              }
            }
          }
        }
      } catch (err) {
        console.warn('Background Cloudinary re-upload failed:', err.message);
      }
    });
  }
);

// ─── POST /api/applicants/:id/send-email (admin: manual trigger) ─────────────
router.post('/:id/send-email', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  const { type } = req.body;
  const allowed = ['registration_received', 'payment_submitted', 'payment_verified', 'admitted'];
  if (!allowed.includes(type)) return res.status(400).json({ error: 'Invalid email type' });

  try {
    const [rows] = await pool.query(`
      SELECT a.*, p.amount_paid 
      FROM applicants a 
      LEFT JOIN payments p ON p.applicant_id = a.id
      WHERE a.id = ?`, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Applicant not found' });
    const appl = rows[0];

    await sendEmail(appl.guardian_email, type, {
      form_number: appl.form_number,
      full_name: `${appl.first_name} ${appl.surname}`,
      guardian_name: appl.guardian_name,
      sport: appl.sport_selection,
      category: appl.age_category,
      amount: appl.amount_paid || 0,
      group: appl.group_assigned,
      coach: appl.coach_assigned,
      room: appl.room_number
    }, appl.id, req.admin.id);

    res.json({ success: true, message: `Email (${type}) sent to ${appl.guardian_email}` });
  } catch (err) {
    console.error('Manual email send failed:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.patch('/:id/status', authenticate, requireRole('admin','super_admin'), async (req, res) => {
  const { 
    status, // Lifecycle status (Legacy)
    is_medical_cleared, 
    is_admitted, 
    is_payment_verified,
    group_assigned, 
    room_number, 
    coach_assigned 
  } = req.body;

  // Fetch current data
  const [currentRows] = await pool.query('SELECT * FROM applicants WHERE id = ?', [req.params.id]);
  if (!currentRows.length) return res.status(404).json({ error: 'Applicant not found' });
  const current = currentRows[0];

  const updates = [];
  const params = [];

  const addUpdate = (col, val) => {
    if (val !== undefined) {
      updates.push(`${col} = ?`);
      params.push(val);
    }
  };

  addUpdate('status', status);
  addUpdate('is_medical_cleared', is_medical_cleared === true || is_medical_cleared === 1 ? 1 : (is_medical_cleared === false || is_medical_cleared === 0 ? 0 : undefined));
  addUpdate('is_admitted', is_admitted === true || is_admitted === 1 ? 1 : (is_admitted === false || is_admitted === 0 ? 0 : undefined));
  addUpdate('is_payment_verified', is_payment_verified === true || is_payment_verified === 1 ? 1 : (is_payment_verified === false || is_payment_verified === 0 ? 0 : undefined));
  
  if (is_admitted === true || status === 'Admitted') {
    updates.push('id_card_generated = TRUE');
    updates.push('id_card_generated_at = COALESCE(id_card_generated_at, CURRENT_TIMESTAMP)');
  }

  addUpdate('group_assigned', group_assigned);
  addUpdate('room_number', room_number);
  addUpdate('coach_assigned', coach_assigned);

  if (updates.length > 0) {
    params.push(req.params.id);
    await pool.query(`UPDATE applicants SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Sync Payment Table if verified changed
  if (is_payment_verified === true) {
    const [existingPmt] = await pool.query("SELECT id FROM payments WHERE applicant_id = ?", [req.params.id]);
    if (existingPmt.length) {
      await pool.query(
        "UPDATE payments SET verification_status = 'Verified', verified_at = CURRENT_TIMESTAMP WHERE applicant_id = ?",
        [req.params.id]
      );
    } else {
      await pool.query(
        `INSERT INTO payments (applicant_id, amount_paid, fee_type, verification_status, verified_at, notes)
         VALUES (?, 0, 'Regular', 'Verified', CURRENT_TIMESTAMP, 'Manually verified via status update')`,
        [req.params.id]
      );
    }
  }

  // Audit log
  await pool.query(
    'INSERT INTO audit_log (admin_id, action, table_name, record_id, new_value) VALUES (?,?,?,?,?)',
    [req.admin.id, 'status_change', 'applicants', req.params.id, JSON.stringify(req.body)]
  );

  // Fetch updated info for ID card etc
  const [updatedRows] = await pool.query(
    'SELECT *, first_name || \' \' || surname AS full_name FROM applicants WHERE id = ?',
    [req.params.id]
  );
  const appl = updatedRows[0];

  const idCard = (appl.is_admitted || appl.status === 'Admitted')
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

  res.json({
    success: true,
    id_card: idCard,
    applied_status: appl.status
  });
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

module.exports = router;
