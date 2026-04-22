require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { swaggerSpec } = require('../../src/infrastructure/config/swagger');

const root = path.resolve(__dirname, '../../src');

const domains = ['auth', 'company', 'deal', 'chat', 'file', 'support', 'system', 'health'];

test('legacy layered folders are removed', () => {
  const legacy = [
    'controllers',
    'services',
    'repositories',
    'routes',
    'middlewares',
    'utils',
    'config',
  ];
  for (const dir of legacy) {
    assert.equal(fs.existsSync(path.join(root, dir)), false, `${dir} should not exist in src/`);
  }
});

test('each core module exposes index and expected folders', () => {
  for (const domain of domains) {
    const base = path.join(root, 'modules', domain);
    assert.equal(fs.existsSync(path.join(base, 'index.js')), true, `${domain} index.js missing`);
    assert.equal(fs.existsSync(path.join(base, 'routes')), true, `${domain} routes missing`);
    assert.equal(
      fs.existsSync(path.join(base, 'controller')),
      true,
      `${domain} controller missing`
    );
  }
});

test('route registry still exposes v1 endpoint groups', () => {
  const endpoints = Object.keys(swaggerSpec.paths || {});

  const requiredPrefixes = [
    '/api/v1/health',
    '/api/v1/system',
    '/api/v1/auth',
    '/api/v1/companies',
    '/api/v1/files',
    '/api/v1/users',
    '/api/v1/deals',
    '/api/v1/chats',
    '/api/v1/support',
  ];

  for (const prefix of requiredPrefixes) {
    const found = endpoints.some((pathItem) => pathItem.startsWith(prefix));
    assert.equal(found, true, `Missing endpoint prefix: ${prefix}`);
  }
});
