require('../helpers/infraTeardown');
const test = require('node:test');
const assert = require('node:assert/strict');

const { searchSchema } = require('../../src/modules/search/validation/search.validation');

test('search schema parses csv types and trims q', () => {
  const parsed = searchSchema.parse({
    query: {
      q: '  قهوة عربية  ',
      types: 'companies,deals,myRequests',
      limit: '10',
      offset: '2',
    },
  });

  assert.equal(parsed.query.q, 'قهوة عربية');
  assert.deepEqual(parsed.query.types, ['companies', 'deals', 'myRequests']);
  assert.equal(parsed.query.limit, 10);
  assert.equal(parsed.query.offset, 2);
});

test('search schema rejects short query', () => {
  const result = searchSchema.safeParse({ query: { q: 'a' } });
  assert.equal(result.success, false);
});
