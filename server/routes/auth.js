const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool    = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { getPricingConfig, getPricingDefaults, toBoolean, toNumber } = require('../utils/pricing');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login',
  body('username').notEmpty().trim(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, password } = req.body;
    try {
      const [rows] = await pool.query(
        'SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE',
        [username]
      );
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const admin = rows[0];
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      await pool.query('UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);

      const token = jwt.sign(
        { id: admin.id, username: admin.username, role: admin.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      res.json({
        token,
        admin: { id: admin.id, name: admin.name, username: admin.username, email: admin.email, role: admin.role }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ admin: req.admin });
});

// ── GET /api/auth/settings/auto-accept-mode ────────────────────────────────
router.get('/settings/auto-accept-mode', authenticate, async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT setting_value FROM app_settings WHERE setting_key = 'auto_accept_mode' LIMIT 1"
  );
  const mode = rows[0]?.setting_value || 'balanced';
  res.json({ mode });
});

// ── PATCH /api/auth/settings/auto-accept-mode ──────────────────────────────
router.patch('/settings/auto-accept-mode',
  authenticate,
  requireRole('admin', 'super_admin'),
  body('mode').isIn(['strict', 'balanced', 'lenient']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { mode } = req.body;
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES ('auto_accept_mode', ?, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value,
           updated_at = CURRENT_TIMESTAMP`,
      [mode]
    );
    res.json({ success: true, mode });
  }
);

router.get('/settings/pricing', authenticate, requireRole('admin', 'super_admin'), async (_req, res) => {
  const pricing = await getPricingConfig(pool);
  res.json({ pricing });
});

router.patch('/settings/pricing',
  authenticate,
  requireRole('admin', 'super_admin'),
  body('camp_fee_amount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('early_bird_enabled').optional({ nullable: true }).isBoolean(),
  body('early_bird_discount_pct').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('early_bird_fee_amount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('early_bird_deadline').optional({ nullable: true }).isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const defaults = getPricingDefaults();
    const current = await getPricingConfig(pool);

    const next = {
      camp_fee_amount: req.body.camp_fee_amount !== undefined ? toNumber(req.body.camp_fee_amount, defaults.camp_fee_amount) : current.regular_fee,
      early_bird_enabled: req.body.early_bird_enabled !== undefined ? toBoolean(req.body.early_bird_enabled, true) : current.early_bird_enabled,
      early_bird_discount_pct: req.body.early_bird_discount_pct !== undefined ? toNumber(req.body.early_bird_discount_pct, defaults.early_bird_discount_pct) : current.early_bird_discount_pct,
      early_bird_fee_amount: req.body.early_bird_fee_amount !== undefined ? toNumber(req.body.early_bird_fee_amount, null) : current.early_bird_fee_amount,
      early_bird_deadline: req.body.early_bird_deadline || current.early_bird_deadline,
    };

    const upserts = [
      ['camp_fee_amount', String(next.camp_fee_amount)],
      ['early_bird_enabled', next.early_bird_enabled ? '1' : '0'],
      ['early_bird_discount_pct', String(next.early_bird_discount_pct)],
      ['early_bird_fee_amount', next.early_bird_fee_amount == null ? '' : String(next.early_bird_fee_amount)],
      ['early_bird_deadline', next.early_bird_deadline],
    ];
    for (const [key, value] of upserts) {
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key) DO UPDATE
         SET setting_value = EXCLUDED.setting_value,
             updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    }

    const pricing = await getPricingConfig(pool);
    res.json({ success: true, pricing });
  }
);

// ── POST /api/auth/create-admin  (super_admin only) ──────────────────────────
router.post('/create-admin',
  authenticate,
  requireRole('super_admin'),
  body('name').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['admin','verifier','super_admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role } = req.body;
    try {
      const hash = await bcrypt.hash(password, 12);
      const [result] = await pool.query(
        'INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hash, role]
      );
      res.status(201).json({ id: result.insertId, name, email, role });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// ── GET /api/auth/admins  (super_admin only) ──────────────────────────────────
router.get('/admins', authenticate, requireRole('super_admin'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, is_active, last_login, created_at FROM admin_users ORDER BY created_at DESC'
  );
  res.json(rows);
});

// ── PATCH /api/auth/admins/:id ────────────────────────────────────────────────
router.patch('/admins/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  const { is_active, role } = req.body;
  await pool.query(
    'UPDATE admin_users SET is_active = COALESCE(?, is_active), role = COALESCE(?, role) WHERE id = ?',
    [is_active, role, req.params.id]
  );
  res.json({ success: true });
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate,
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
  async (req, res) => {
    const { current_password, new_password } = req.body;
    const [rows] = await pool.query('SELECT password_hash FROM admin_users WHERE id = ?', [req.admin.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, req.admin.id]);
    res.json({ success: true });
  }
);

module.exports = router;
