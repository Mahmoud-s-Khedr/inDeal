const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');

const validate = require('../../src/core/middleware/validateMiddleware');

test('stores parsed and coerced request input without mutating the raw query object', () => {
  const rawQuery = { canceled: 'true' };
  const req = { body: {}, params: {}, query: rawQuery };
  const schema = z.object({
    body: z.object({}),
    params: z.object({}),
    query: z.object({
      canceled: z.preprocess((value) => value === 'true', z.boolean()),
      limit: z.coerce.number().default(50),
    }),
  });

  let nextError;
  validate(schema)(req, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError, undefined);
  assert.equal(req.query, rawQuery);
  assert.equal(req.query.canceled, 'true');
  assert.deepEqual(req.validated.query, { canceled: true, limit: 50 });
});
