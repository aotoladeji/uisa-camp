const express = require('express');
const pool    = require('../db/pool');
const upload  = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendEmail } = require('../middleware/email');
const { extractPaymentDetails } = require('../middleware/ocr');
const { getPricingConfig } = require('../utils/pricing');

const router = express.Router();

// ─── POST /api/payments/submit  (public: applicant uploads receipt) ────────────
router.post('/submit',
  upload.single('receipt'),
  async (req, res) => {
    let { applicant_id, form_number, guardian_email, payment_plan, transaction_ref, payment_date, amount_paid } = req.body;

    applicant_id = applicant_id ? String(applicant_id).trim() : '';
    form_number = form_number ? String(form_number).trim() : '';
    guardian_email = guardian_email ? String(guardian_email).trim() : '';

    // Accept either numeric applicant_id or UI form number typed into the same field.
    if (applicant_id && !/^\d+$/.test(applicant_id) && !form_number) {
      form_number = applicant_id;
      applicant_id = '';
    }

    if (!req.file) return res.status(400).json({ error: 'Receipt file is required' });

    try {
      // Verify applicant exists by ID or form number to support both payment-link flows.
      let rows = [];
      if (applicant_id) {
        [rows] = await pool.query(
          'SELECT id, guardian_email, form_number, CONCAT(first_name," ",surname) AS full_name, guardian_name, sport_selection FROM applicants WHERE id = ? AND LOWER(TRIM(guardian_email)) = LOWER(TRIM(?))',
          [parseInt(applicant_id, 10), guardian_email]
        );
      }
      if (!rows.length && form_number) {
        [rows] = await pool.query(
          'SELECT id, guardian_email, form_number, CONCAT(first_name," ",surname) AS full_name, guardian_name, sport_selection FROM applicants WHERE form_number = ? AND LOWER(TRIM(guardian_email)) = LOWER(TRIM(?))',
          [form_number, guardian_email]
        );
      }
      if (!rows.length && guardian_email) {
        // Fallback for stale payment links: pick the latest application for this guardian email.
        [rows] = await pool.query(
          `SELECT id, guardian_email, form_number, CONCAT(first_name," ",surname) AS full_name, guardian_name, sport_selection
           FROM applicants
           WHERE LOWER(TRIM(guardian_email)) = LOWER(TRIM(?))
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [guardian_email]
        );
      }
      if (!rows.length) return res.status(404).json({ error: 'Application not found. Check your email address.' });

      const appl = rows[0];
      applicant_id = appl.id;
      const pricing = await getPricingConfig(pool);
      const selectedPlan = payment_plan === 'Early Bird' || payment_plan === 'Regular'
        ? payment_plan
        : (pricing.early_bird_active ? 'Early Bird' : 'Regular');
      if (selectedPlan === 'Early Bird' && !pricing.early_bird_active) {
        return res.status(400).json({ error: 'Early bird discount is currently disabled.' });
      }
      const discount = selectedPlan === 'Early Bird' ? pricing.early_bird_discount_pct : 0;
      const gross = pricing.regular_fee;
      const final = selectedPlan === 'Early Bird' ? pricing.computed_early_bird_fee : gross;
      const submittedAmount = amount_paid || final;
      const submittedRef = transaction_ref || null;
      const submittedDate = payment_date || null;

      // Check for existing payment
      const [existing] = await pool.query('SELECT id FROM payments WHERE applicant_id = ?', [applicant_id]);
      if (existing.length) {
        // Update existing
        await pool.query(`
          UPDATE payments SET
            amount_paid = ?, fee_type = ?, discount_pct = ?, gross_amount = ?,
            transaction_ref = ?, payment_date = ?, receipt_path = ?,
            verification_status = 'Pending', updated_at = CURRENT_TIMESTAMP
          WHERE applicant_id = ?`,
          [submittedAmount, selectedPlan, discount, gross,
           submittedRef, submittedDate, req.file.path, applicant_id]
        );
      } else {
        await pool.query(`
          INSERT INTO payments
            (applicant_id, amount_paid, fee_type, discount_pct, gross_amount,
             transaction_ref, payment_date, receipt_path, bank_name, account_number)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [applicant_id, submittedAmount, selectedPlan,
           discount, gross, submittedRef, submittedDate, req.file.path,
           'Access Bank', null]
        );
      }

      // Update applicant status
      await pool.query(
        "UPDATE applicants SET status = 'Payment Submitted' WHERE id = ?", [applicant_id]
      );

      res.json({ 
        success: true, 
        message: 'Receipt submitted. Details extraction is processing and you will be notified after verification.',
        pricing
      });

      // Process OCR and email after responding to reduce submit latency.
      setImmediate(async () => {
        try {
          const extracted = await extractPaymentDetails(req.file.path);

          const [paymentRows] = await pool.query(
            'SELECT id, transaction_ref, payment_date, bank_name, account_number FROM payments WHERE applicant_id = ? ORDER BY id DESC LIMIT 1',
            [applicant_id]
          );
          if (paymentRows.length) {
            const payment = paymentRows[0];
            await pool.query(
              `UPDATE payments
               SET transaction_ref = ?, payment_date = ?, bank_name = ?, account_number = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [
                payment.transaction_ref || extracted.transaction_ref || null,
                payment.payment_date || extracted.payment_date || null,
                payment.bank_name || extracted.bank_name || 'Access Bank',
                payment.account_number || extracted.account_number || null,
                payment.id,
              ]
            );
          }

          await sendEmail(appl.guardian_email, 'payment_submitted', {
            form_number: appl.form_number,
            full_name: appl.full_name,
            guardian_name: appl.guardian_name,
            amount: submittedAmount,
          });
        } catch (bgErr) {
          console.warn('Background payment post-processing failed:', bgErr.message);
        }
      });
    } catch (err) {
      console.error('Payment submit error:', err);
      res.status(500).json({ error: 'Could not submit payment. Please try again.' });
    }
  }
);

// ─── GET /api/payments  (admin) ───────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';

  if (status) { where += ' AND p.verification_status = ?'; params.push(status); }
  if (search) {
    where += ' AND (a.form_number LIKE ? OR a.surname LIKE ? OR a.first_name LIKE ? OR p.transaction_ref LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const [rows] = await pool.query(`
    SELECT p.*, a.form_number, a.surname, a.first_name, a.guardian_email,
           a.sport_selection, CONCAT(a.first_name,' ',a.surname) AS full_name
    FROM payments p
    JOIN applicants a ON a.id = p.applicant_id
    ${where}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM payments p JOIN applicants a ON a.id=p.applicant_id ${where}`,
    params
  );

  res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
});

// ─── GET /api/payments/:id  (admin) ───────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*, a.form_number, a.surname, a.first_name, a.guardian_email, a.guardian_phone,
           a.sport_selection, CONCAT(a.first_name,' ',a.surname) AS full_name
    FROM payments p JOIN applicants a ON a.id=p.applicant_id
    WHERE p.id=?`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// ─── PATCH /api/payments/:id/verify  (admin: verify or reject payment) ────────
router.patch('/:id/verify', authenticate, requireRole('admin','verifier','super_admin'), async (req, res) => {
  const { action, rejection_reason, notes } = req.body;
  if (!['verify','reject'].includes(action)) return res.status(400).json({ error: 'action must be verify or reject' });

  const status = action === 'verify' ? 'Verified' : 'Rejected';

  await pool.query(`
    UPDATE payments SET
      verification_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP,
      rejection_reason = COALESCE(?, rejection_reason), notes = COALESCE(?, notes)
    WHERE id = ?`,
    [status, req.admin.id, rejection_reason||null, notes||null, req.params.id]
  );

  // Fetch payment + applicant
  const [[pmt]] = await pool.query(`
    SELECT p.amount_paid, a.id AS applicant_id, a.form_number,
           a.guardian_email, a.guardian_name,
           CONCAT(a.first_name,' ',a.surname) AS full_name
    FROM payments p JOIN applicants a ON a.id=p.applicant_id WHERE p.id=?`,
    [req.params.id]
  );

  // Update applicant status
  if (action === 'verify') {
    await pool.query(
      "UPDATE applicants SET status='Payment Verified' WHERE id=?", [pmt.applicant_id]
    );
    await sendEmail(pmt.guardian_email, 'payment_verified', {
      form_number: pmt.form_number,
      full_name: pmt.full_name,
      guardian_name: pmt.guardian_name,
      amount: pmt.amount_paid,
    });
  }

  // Audit log
  await pool.query(
    'INSERT INTO audit_log (admin_id, action, table_name, record_id, new_value) VALUES (?,?,?,?,?)',
    [req.admin.id, `payment_${action}`, 'payments', req.params.id, JSON.stringify({ status, rejection_reason })]
  );

  res.json({ success: true, status });
});

module.exports = router;
