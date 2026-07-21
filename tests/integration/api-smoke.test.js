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

test('allows configured browser origins with credentials', async () => {
  const origin = 'http://localhost:3000';
  const res = await request(app).get('/').set('Origin', origin);

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], origin);
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

test('allows preflight requests from configured browser origins', async () => {
  const origin = 'https://indealeg.com';
  const res = await request(app)
    .options('/api/v1/auth/login')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'POST');

  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], origin);
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

test('does not grant CORS access to unconfigured browser origins', async () => {
  const res = await request(app).get('/').set('Origin', 'https://untrusted.example');

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.equal(res.headers['access-control-allow-credentials'], undefined);
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

test('GET /api/v1/admin/users requires authentication', async () => {
  const res = await request(app).get('/api/v1/admin/users');
  assert.equal(res.status, 401);
});

test('POST /api/v1/deals/send-email requires authentication', async () => {
  const res = await request(app).post('/api/v1/deals/send-email').send({
    dealId: 1,
    subject: 'Hello',
    message: 'Testing',
  });
  assert.equal(res.status, 401);
});
