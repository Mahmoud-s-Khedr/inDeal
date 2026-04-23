require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');

test('GET /api/v1/search rejects short q', async () => {
  const res = await request(app).get('/api/v1/search').query({ q: 'a' });
  assert.equal(res.status, 400);
});

test('GET /api/v1/search rejects invalid type enum', async () => {
  const res = await request(app)
    .get('/api/v1/search')
    .query({ q: 'steel', types: 'companies,unknown' });
  assert.equal(res.status, 400);
});
