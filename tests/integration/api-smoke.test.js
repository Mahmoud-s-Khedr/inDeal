require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

test('GET / responds with service banner', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /inDeal API is running/i);
});

test('GET /api/v1/health responds healthy', async () => {
  const res = await request(app).get('/api/v1/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'success');
  assert.equal(res.body.data.status, 'ok');
});

test('GET /api/v1/system/config returns languages', async () => {
  const res = await request(app).get('/api/v1/system/config');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'success');
  assert.ok(Array.isArray(res.body.data.languages));
});

test('POST /api/v1/auth/login validates payload', async () => {
  const res = await request(app).post('/api/v1/auth/login').send({});
  assert.equal(res.status, 400);
});
