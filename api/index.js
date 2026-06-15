// Vercel serverless entry point
const path = require('path');

// Load .env from server directory (no-op in production where Vercel sets env vars directly)
try {
  require(path.join(__dirname, '../server/node_modules/dotenv')).config({
    path: path.join(__dirname, '../server/.env'),
  });
} catch (_) {
  // dotenv unavailable or .env not present — env vars come from Vercel dashboard
}

const app = require('../server/app');
module.exports = app;
