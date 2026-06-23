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
  const state = { queries: [] };

  const repository = loadRepositoryWithMocks({
    [resolveFromRepository('../../../infrastructure/config/db')]: {
      pool: {
        query: async (query, params) => {
          state.queries.push({ query, params });
          return { rows: [{ total: '0' }] };
        },
      },
    },
  });

  return { repository, state };
};

test('findByCompanyId applies type filter and applications sorting', async () => {
  const { repository, state } = buildHarness();

  await repository.findByCompanyId(7, {
    type: 'supply',
    sortBy: 'applications',
    sortOrder: 'asc',
    limit: 10,
    offset: 0,
  });

  assert.match(state.queries[0].query, /d\.deal_type = \$3/);
  assert.match(state.queries[0].query, /ORDER BY applications_count ASC, d\.id DESC/);
  assert.deepEqual(state.queries[0].params, [7, 'archived', 'supply', 10, 0]);
});

test('countByCompanyId applies type filter', async () => {
  const { repository, state } = buildHarness();

  await repository.countByCompanyId(7, { type: 'demand' });

  assert.match(state.queries[0].query, /d\.deal_type = \$3/);
  assert.deepEqual(state.queries[0].params, [7, 'archived', 'demand']);
});
