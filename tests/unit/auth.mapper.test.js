require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toRegistrationDocType,
  toExternalDocType,
  sanitizeUser,
} = require('../../src/modules/auth/mappers/auth.mapper');

test('auth mapper converts registration doc types', () => {
  assert.equal(toRegistrationDocType('license'), 'registration:license');
  assert.equal(toRegistrationDocType(''), 'registration:other');
  assert.equal(toExternalDocType('registration:tax-card'), 'tax-card');
});

test('auth mapper sanitizes user DTO', () => {
  const user = sanitizeUser({
    id: 7,
    username: 'agent007',
    email: 'a@b.com',
    first_name: 'A',
    last_name: 'B',
    job_title: 'CEO',
    role: 'agent',
    status: 'active',
    created_at: '2026-01-01',
    updated_at: '2026-01-02',
  });

  assert.equal(user.firstName, 'A');
  assert.equal(user.lastName, 'B');
  assert.equal(user.jobTitle, 'CEO');
});
