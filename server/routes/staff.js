const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const upload = require('../middleware/upload');
const { authenticate, requireRole } = require('../middleware/auth');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();

const normalizeUploadPath = (value) => {
  if (!value) return null;
  const s = String(value);
  if (s.startsWith('http')) return s;
  return s.replace(/\\/g, '/').replace(/^\.?\//, '');
};

router.get('/', authenticate, requireRole('admin', 'super_admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, full_name, designation, department, phone, email, username, photo_url, theme_color, created_at
      FROM staff_members
      ORDER BY created_at DESC
    `);
    res.json(rows.map(r => ({ ...r, photo_url: normalizeUploadPath(r.photo_url) })));
  } catch (err) {
    console.error('Staff list error:', err);
    res.status(500).json({ error: 'Failed to load staff' });
  }
});

router.post('/',
  authenticate,
  requireRole('admin', 'super_admin'),
  upload.single('photo'),
  body('full_name').notEmpty(),
  body('designation').notEmpty(),
  body('department').optional().isString(),
  body('email').optional({ nullable: true }).isEmail(),
  body('phone').optional({ nullable: true }).isString(),
  body('username').optional({ nullable: true }).isString(),
  body('theme_color').optional({ nullable: true }).isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, designation, department = 'Staff', phone = '', email = '', username, theme_color } = req.body;

    try {
      let finalUsername = username && String(username).trim() ? String(username).trim() : String(full_name || 'staff').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || `staff${Date.now()}`;
      let suffix = 0;
      let candidate = finalUsername;
      while (true) {
        const [existing] = await pool.query('SELECT id FROM staff_members WHERE LOWER(username) = LOWER(?) LIMIT 1', [candidate]);
        if (!existing.length) break;
        suffix += 1;
        candidate = `${finalUsername}${suffix}`;
      }
      finalUsername = candidate;

      let photoUrl = null;
      if (req.file) {
        try {
          photoUrl = await cloudinary.uploadToCloudinary(req.file.buffer, 'uisa/staff', `staff-${Date.now()}`);
        } catch (cloudErr) {
          console.warn('Staff photo upload failed:', cloudErr.message);
        }
      }

      const [result] = await pool.query(
        `INSERT INTO staff_members (full_name, designation, department, phone, email, username, photo_url, theme_color, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [full_name, designation, department, phone, email, finalUsername, photoUrl, theme_color || '#0F766E']
      );

      const [rows] = await pool.query(`SELECT id, full_name, designation, department, phone, email, username, photo_url, theme_color, created_at
        FROM staff_members WHERE id = ?`, [result.insertId]);
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Staff create error:', err);
      res.status(500).json({ error: 'Failed to create staff' });
    }
  }
);

router.patch('/:id', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { full_name, designation, department, phone, email, theme_color } = req.body;
    const updates = [];
    const params = [];
    if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
    if (designation !== undefined) { updates.push('designation = ?'); params.push(designation); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (theme_color !== undefined) { updates.push('theme_color = ?'); params.push(theme_color); }
    if (!updates.length) return res.json({ success: true });
    params.push(req.params.id);
    await pool.query(`UPDATE staff_members SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Staff update error:', err);
    res.status(500).json({ error: 'Failed to update staff' });
  }
});

module.exports = router;
