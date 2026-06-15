const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const repositoryPath = path.resolve(
  __dirname,
  '../../src/modules/deal/repository/dealRequest.repository.js'
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
    queries: [],
  };

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

test('findByApplicantCompanyId limits /me/requests to direct and inSupply by default', async () => {
  const { repository, state } = buildHarness();

  await repository.findByApplicantCompanyId(10, {
    requestTypes: ['direct', 'inSupply'],
    limit: 10,
    offset: 0,
  });

  assert.match(state.queries[0].query, /r\.request_type = ANY/);
  assert.deepEqual(state.queries[0].params, [10, ['direct', 'inSupply'], 10, 0]);
});

test('findByApplicantCompanyId narrows to a single requestType when requested', async () => {
  const { repository, state } = buildHarness();

  await repository.findByApplicantCompanyId(10, {
    requestType: 'direct',
    requestTypes: ['direct', 'inSupply'],
    limit: 10,
    offset: 0,
  });

  assert.match(state.queries[0].query, /r\.request_type = \$2/);
  assert.match(state.queries[0].query, /r\.request_type = ANY\(\$3::text\[\]\)/);
  assert.deepEqual(state.queries[0].params, [10, 'direct', ['direct', 'inSupply'], 10, 0]);
});

test('findByDealId and getRequestStats honor optional requestType filters', async () => {
  const { repository, state } = buildHarness();

  await repository.findByDealId(55, {
    requestType: 'inDemand',
    limit: 10,
    offset: 0,
  });
  await repository.getRequestStats(55, { requestType: 'inDemand' });

  assert.match(state.queries[0].query, /AND r\.request_type = \$2/);
  assert.deepEqual(state.queries[0].params, [55, 'inDemand', 10, 0]);
  assert.match(state.queries[1].query, /AND request_type = \$2/);
  assert.deepEqual(state.queries[1].params, [55, 'inDemand']);
});
