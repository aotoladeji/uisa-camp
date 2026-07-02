const multer = require('multer');
const path = require('path');
const fs = require('fs');

// We now use memoryStorage globally since all uploads are stored on Cloudinary.
// This prevents "Read-only file system" errors on Vercel and keeps the codebase clean.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, WEBP, and PDF files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 }
});

module.exports = upload;
