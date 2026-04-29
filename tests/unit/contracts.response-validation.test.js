const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');

const { setHttpContract } = require('../../src/core/contracts/http/registry');
const sendResponse = require('../../src/core/http/response');

const buildRes = (req) => {
  const state = { code: null, payload: null };
  return {
    req,
    locals: {},
    status(code) {
      state.code = code;
      return {
        json(payload) {
          state.payload = payload;
        },
      };
    },
    __state: state,
  };
};

test('sendResponse succeeds when payload matches response DTO', () => {
  setHttpContract('get', '/api/v1/contracts/pass', {
    successResponseSchema: z.object({
      status: z.literal('success'),
      message: z.string(),
      data: z.object({ id: z.number() }),
    }),
  });

  const req = {
    method: 'GET',
    baseUrl: '/api/v1/contracts',
    route: { path: '/pass' },
    originalUrl: '/api/v1/contracts/pass',
  };
  const res = buildRes(req);

  sendResponse(res, 200, { id: 1 }, 'ok');

  assert.equal(res.__state.code, 200);
  assert.equal(res.__state.payload.status, 'success');
  assert.equal(res.__state.payload.data.id, 1);
});

test('sendResponse throws when payload does not match response DTO', () => {
  setHttpContract('get', '/api/v1/contracts/fail', {
    successResponseSchema: z.object({
      status: z.literal('success'),
      message: z.string(),
      data: z.object({ id: z.number() }),
    }),
  });

  const req = {
    method: 'GET',
    baseUrl: '/api/v1/contracts',
    route: { path: '/fail' },
    originalUrl: '/api/v1/contracts/fail',
  };
  const res = buildRes(req);

  assert.throws(() => sendResponse(res, 200, { id: 'x' }, 'bad'), /Response DTO validation failed/);
});
