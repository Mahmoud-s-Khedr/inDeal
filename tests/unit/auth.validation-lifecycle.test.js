require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  verifyEmailSchema,
  verifyEmailQuerySchema,
  resendVerificationSchema,
} = require('../../src/modules/auth/validation/auth.validation');
const { updatePasswordSchema } = require('../../src/modules/user/validation/user.validation');

test('verifyEmailSchema accepts valid payload', () => {
  const parsed = verifyEmailSchema.parse({
    body: {
      email: 'agent@indeal.com',
      otp: '123456',
    },
  });
  assert.equal(parsed.body.otp, '123456');
});

test('resendVerificationSchema requires valid email', () => {
  assert.throws(() => {
    resendVerificationSchema.parse({ body: { email: 'bad-email' } });
  });
});

test('verifyEmailQuerySchema accepts valid query params', () => {
  const parsed = verifyEmailQuerySchema.parse({
    query: {
      email: 'agent@indeal.com',
      otp: '123456',
    },
  });
  assert.equal(parsed.query.otp, '123456');
});

test('updatePasswordSchema enforces min 8 chars', () => {
  assert.throws(() => {
    updatePasswordSchema.parse({
      body: {
        currentPassword: '1234567',
        newPassword: '1234567',
      },
    });
  });
});
