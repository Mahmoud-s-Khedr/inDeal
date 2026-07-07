require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../src/app');
const { seedDevData } = require('../../src/seed/devSeeder');
const userModule = require('../../src/modules/user');

const { userRepository } = userModule.repository;

const ensureSupportUser = async () => {
  const email = 'support@indeal.local';
  const password = 'Password123!';
  const existing = await userRepository.findByEmail(email);

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await userRepository.createUser(null, {
      username: 'support1',
      email,
      passwordHash,
      firstName: 'Support',
      lastName: 'User',
      jobTitle: 'Ops',
    });
    await userRepository.updateById(created.id, { role: 'support', status: 'verified' });
    return { id: created.id, email, password };
  }

  await userRepository.updateById(existing.id, {
    role: 'support',
    status: 'verified',
    username: 'support1',
    first_name: 'Support',
    last_name: 'User',
  });

  await userRepository.updatePasswordHash(existing.id, await bcrypt.hash(password, 12));
  return { id: existing.id, email, password };
};

const login = async (email, password) => {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  assert.equal(res.status, 200);
  return res.body.data.token;
};

let seeded;
let supportUser;
let dbAvailable = true;

test.before(async () => {
  try {
    seeded = await seedDevData();
    supportUser = await ensureSupportUser();
  } catch {
    dbAvailable = false;
  }
});

test('agent cannot access admin routes', async (t) => {
  if (!dbAvailable) {
    t.skip('database not available for auth-backed integration test');
    return;
  }
  const token = await login('agent1@indeal.local', 'Password123!');
  const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});

test('support has read-only access to admin routes', async (t) => {
  if (!dbAvailable) {
    t.skip('database not available for auth-backed integration test');
    return;
  }
  const token = await login(supportUser.email, supportUser.password);

  const readRes = await request(app)
    .get('/api/v1/admin/users')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.status, 'success');
  assert.ok(Array.isArray(readRes.body.data.items));

  const writeRes = await request(app)
    .patch(`/api/v1/admin/users/${seeded.admin.id}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'suspended' });
  assert.equal(writeRes.status, 403);
});

test('admin can read admin users list', async (t) => {
  if (!dbAvailable) {
    t.skip('database not available for auth-backed integration test');
    return;
  }
  const token = await login('admin@indeal.local', 'Password123!');
  const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'success');
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(res.body.data.pagination);
});
