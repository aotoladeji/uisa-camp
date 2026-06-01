const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../app');

test('GET /api/health returns service metadata', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.ok(typeof res.body.time === 'string');
});

test('POST /api/auth/login rejects invalid credentials', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'not-a-user', password: 'wrong-password' });

  assert.equal(res.status, 401);
});

test('GET /api/applicants/lookup validates required query params', async () => {
  const res = await request(app).get('/api/applicants/lookup');
  assert.equal(res.status, 400);
});

test('GET /api/applicants requires authentication', async () => {
  const res = await request(app).get('/api/applicants');
  assert.equal(res.status, 401);
});

test('GET /api/payments requires authentication', async () => {
  const res = await request(app).get('/api/payments');
  assert.equal(res.status, 401);
});