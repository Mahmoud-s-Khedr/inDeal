require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../src/modules/auth/service/auth.service');
const config = require('../../src/infrastructure/config/env');

const { buildDebugOtpPayload } = authService.__testables;

const withDebugFlag = async (enabled, fn) => {
  const previous = config.auth.debugOtpEnabled;
  config.auth.debugOtpEnabled = enabled;
  try {
    await fn();
  } finally {
    config.auth.debugOtpEnabled = previous;
  }
};

test('buildDebugOtpPayload returns payload when debug OTP is enabled', async () => {
  await withDebugFlag(true, async () => {
    const payload = buildDebugOtpPayload('forgot-password', '123456');
    assert.equal(payload.purpose, 'forgot-password');
    assert.equal(payload.otp, '123456');
    assert.ok(payload.ttlMinutes > 0);
    assert.equal(payload.env, config.app.env);
  });
});

test('buildDebugOtpPayload returns null when debug OTP is disabled', async () => {
  await withDebugFlag(false, async () => {
    const payload = buildDebugOtpPayload('registration', '654321');
    assert.equal(payload, null);
  });
});
