const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const controllerPath = path.resolve(
  __dirname,
  '../../src/modules/deal/controller/deal.controller.js'
);
const controllerDir = path.dirname(controllerPath);
const resolveFromController = (request) => require.resolve(request, { paths: [controllerDir] });

const loadController = (dealService) => {
  delete require.cache[controllerPath];
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    let resolved;
    try {
      resolved = Module._resolveFilename(request, parent, isMain);
    } catch {
      resolved = null;
    }
    if (resolved === resolveFromController('../service/deal.service')) return dealService;
    return originalLoad.apply(this, arguments);
  };

  try {
    return require(controllerPath);
  } finally {
    Module._load = originalLoad;
  }
};

const invoke = async (handler, { params = {} } = {}) => {
  const calls = [];
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const req = {
    method: 'GET',
    originalUrl: '/api/v1/deals/test',
    params,
    query: { canceled: 'true' },
    validated: { query: { canceled: true, limit: 50, offset: 0 } },
    user: { company: { id: 9 } },
  };
  const res = {
    req,
    locals: {},
    status: (statusCode) => ({
      json: (payload) => {
        calls.push({ statusCode, payload });
        resolveCompletion();
      },
    }),
  };

  handler(req, res, (error) => {
    throw error;
  });
  await completion;
  return calls;
};

test('request-list controllers forward the validated cancelled filter', async () => {
  const calls = [];
  const result = { items: [], pagination: {} };
  const controller = loadController({
    getMyRequests: async (...args) => {
      calls.push(['getMyRequests', args]);
      return result;
    },
    getMyApplications: async (...args) => {
      calls.push(['getMyApplications', args]);
      return result;
    },
    getMyDirectRequests: async (...args) => {
      calls.push(['getMyDirectRequests', args]);
      return result;
    },
    getDealRequests: async (...args) => {
      calls.push(['getDealRequests', args]);
      return result;
    },
  });

  await invoke(controller.getMyRequests);
  await invoke(controller.getMyApplications);
  await invoke(controller.getMyDirectRequests);
  await invoke(controller.getDealRequests, { params: { id: '4' } });

  assert.deepEqual(calls, [
    ['getMyRequests', [9, { canceled: true, limit: 50, offset: 0 }]],
    ['getMyApplications', [9, { canceled: true, limit: 50, offset: 0 }]],
    ['getMyDirectRequests', [9, { canceled: true, limit: 50, offset: 0 }]],
    ['getDealRequests', ['4', 9, { canceled: true, limit: 50, offset: 0 }]],
  ]);
});
