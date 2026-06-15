// Vercel serverless entry point
require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const app = require('../server/app');

module.exports = app;
