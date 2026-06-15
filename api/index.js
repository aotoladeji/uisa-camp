// Vercel serverless entry point — wraps the Express app
require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const app = require('../server/app');

module.exports = app;
