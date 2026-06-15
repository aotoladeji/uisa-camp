// Vercel serverless entry point — runs from client/ root, server is one level up
require('dotenv').config({ path: require('path').join(__dirname, '../../server/.env') });
const app = require('../../server/app');

module.exports = app;
