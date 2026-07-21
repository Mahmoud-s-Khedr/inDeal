const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCorsAllowedOrigins } = require('../../src/infrastructure/config/env');

test('parses comma-separated CORS origins with whitespace and duplicates', () => {
  const origins = parseCorsAllowedOrigins(
    ' http://localhost:3000, https://indealeg.com ,http://localhost:3000 '
  );

  assert.deepEqual(origins, ['http://localhost:3000', 'https://indealeg.com']);
});
