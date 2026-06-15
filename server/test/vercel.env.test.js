/**
 * Simulates the Vercel production environment:
 * - DATABASE_URL is set (Turso path in pool.js is used)
 * - Entry point is api/index.js (not server/index.js)
 * - VERCEL=1 is set
 *
 * Uses a real Turso-compatible URL but expects it to fail with a DB error,
 * NOT a 500 from module loading or missing env vars.
 */
const test    = require('node:test');
const assert  = require('node:assert/strict');
const http    = require('http');

// Set env before any require
process.env.DATABASE_URL = 'libsql://ci-test-placeholder.turso.io';
process.env.LIBSQL_TOKEN = 'ci-placeholder-token';
process.env.JWT_SECRET   = 'ci-test-jwt-secret-32-chars-long!!';
process.env.NODE_ENV     = 'test';
process.env.VERCEL       = '1';
process.env.CLIENT_URL   = 'https://uisa-camp.vercel.app';

// Load the same entry point Vercel uses
const app = require('../../api/index.js');

function makeRequest(server, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: server.address().port, ...options }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(data); } catch { return data; } })() }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let server;
test.before(() => new Promise(resolve => {
  server = http.createServer(app).listen(0, resolve);
}));

test.after(() => new Promise(resolve => server.close(resolve)));

test('api/index.js exports an Express app', () => {
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');
});

test('GET /api/health returns 200 with DATABASE_URL set', async () => {
  const res = await makeRequest(server, { path: '/api/health', method: 'GET' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('POST /api/auth/login returns 500 or 401 — never crashes the process', async () => {
  const body = JSON.stringify({ username: 'admin', password: 'password123' });
  const res = await makeRequest(server, {
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  // With a fake Turso URL we expect a DB error (500), but the process must stay alive
  // and return a JSON error — never a timeout or unhandled crash.
  assert.ok(
    res.status === 401 || res.status === 500,
    `Expected 401 or 500, got ${res.status}`
  );
  assert.ok(typeof res.body === 'object', 'Response must be JSON');
});

test('GET /api/applicants requires authentication even with DATABASE_URL set', async () => {
  const res = await makeRequest(server, { path: '/api/applicants', method: 'GET' });
  assert.equal(res.status, 401);
});
