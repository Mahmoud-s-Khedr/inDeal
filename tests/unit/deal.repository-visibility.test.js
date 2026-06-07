const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const repositoryPath = path.resolve(
  __dirname,
  '../../src/modules/deal/repository/deal.repository.js'
);
const repositoryDir = path.dirname(repositoryPath);

const resolveFromRepository = (request) => require.resolve(request, { paths: [repositoryDir] });

const loadRepositoryWithMocks = (mocksByResolvedPath) => {
  delete require.cache[repositoryPath];

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    let resolved;
    try {
      resolved = Module._resolveFilename(request, parent, isMain);
    } catch {
      resolved = null;
    }

    if (resolved && Object.hasOwn(mocksByResolvedPath, resolved)) {
      return mocksByResolvedPath[resolved];
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    return require(repositoryPath);
  } finally {
    Module._load = originalLoad;
  }
};

const buildHarness = () => {
  const state = {
    lastQuery: null,
    lastParams: null,
  };

  const repository = loadRepositoryWithMocks({
    [resolveFromRepository('../../../infrastructure/config/db')]: {
      pool: {
        query: async (query, params) => {
          state.lastQuery = query;
          state.lastParams = params;
          return { rows: [] };
        },
      },
    },
  });

  return { repository, state };
};

test('findByCompanyId excludes archived deals by default', async () => {
  const { repository, state } = buildHarness();

  await repository.findByCompanyId(44, { limit: 10, offset: 0 });

  assert.match(state.lastQuery, /d\.status != \$2/);
  assert.deepEqual(state.lastParams, [44, 'archived', 10, 0]);
});

test('findByCompanyId honors explicit status filters including archived', async () => {
  const { repository, state } = buildHarness();

  await repository.findByCompanyId(44, { status: 'archived', limit: 10, offset: 0 });

  assert.match(state.lastQuery, /d\.status = \$2/);
  assert.doesNotMatch(state.lastQuery, /d\.status !=/);
  assert.deepEqual(state.lastParams, [44, 'archived', 10, 0]);
});
