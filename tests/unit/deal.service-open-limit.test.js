const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const dealServicePath = path.resolve(__dirname, '../../src/modules/deal/service/deal.service.js');
const serviceDir = path.dirname(dealServicePath);

const resolveFromDealService = (request) => require.resolve(request, { paths: [serviceDir] });

const loadDealServiceWithMocks = (mocksByResolvedPath) => {
  delete require.cache[dealServicePath];

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
    return require(dealServicePath);
  } finally {
    Module._load = originalLoad;
  }
};

const buildHarness = ({
  maxOpenPerCompany = 2,
  openDeals = 0,
  existingDeal = null,
  updatedDeal = null,
} = {}) => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  const state = {
    poolConnectCalls: 0,
    beginCalls: 0,
    commitCalls: 0,
    rollbackCalls: 0,
    countOpenCalls: 0,
    updateCalls: 0,
  };

  const client = {
    query: async (sql) => {
      if (sql === 'BEGIN') state.beginCalls += 1;
      if (sql === 'COMMIT') state.commitCalls += 1;
      if (sql === 'ROLLBACK') state.rollbackCalls += 1;
      return { rows: [] };
    },
    release: () => {},
  };

  const dealRepositoryMock = {
    countOpenByCompanyId: async () => {
      state.countOpenCalls += 1;
      return openDeals;
    },
    findById: async () => existingDeal,
    createDeal: async (_client, payload) => ({
      id: 101,
      company_id: payload.companyId,
      deal_name: payload.dealName,
      deal_description: payload.dealDescription || null,
      deal_value: payload.dealValue || null,
      deal_type: payload.dealType,
      status: payload.status || 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    updateById: async () => {
      state.updateCalls += 1;
      return (
        updatedDeal || {
          id: existingDeal?.id || 1,
          company_id: existingDeal?.company_id || 1,
          deal_name: 'Updated',
          deal_description: null,
          deal_value: null,
          deal_type: 'supply',
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );
    },
  };

  const mocks = {
    [resolveFromDealService('../../../core/errors/AppError')]: AppError,
    [resolveFromDealService('../../../infrastructure/config/db')]: {
      pool: {
        connect: async () => {
          state.poolConnectCalls += 1;
          return client;
        },
      },
    },
    [resolveFromDealService('../../../infrastructure/config/env')]: {
      deals: { maxOpenPerCompany },
      companyReview: {},
    },
    [resolveFromDealService('../repository/deal.repository')]: dealRepositoryMock,
    [resolveFromDealService('../repository/dealRequest.repository')]: {},
    [resolveFromDealService('../repository/dealAttachment.repository')]: {
      replaceForDeal: async () => {},
      listByDealIds: async () => [],
    },
    [resolveFromDealService('../repository/dealRequestDetails.repository')]: {},
    [resolveFromDealService('../../company')]: {
      repository: {
        companyRepository: {
          findById: async (id) => ({ id, status: 'active', name: `Company ${id}` }),
        },
      },
    },
    [resolveFromDealService('../../file')]: {
      repository: { fileRepository: { findByIds: async () => [] } },
      service: { getFileById: async () => null },
    },
    [resolveFromDealService('../../../infrastructure/config/mailer')]: {
      sendMail: async () => {},
    },
    [resolveFromDealService('../../../shared/utils/logger')]: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    },
  };

  const dealService = loadDealServiceWithMocks(mocks);

  return { dealService, state, AppError };
};

test('createDeal keeps existing open-deal-limit behavior', async () => {
  const { dealService, state, AppError } = buildHarness({
    maxOpenPerCompany: 2,
    openDeals: 2,
  });

  await assert.rejects(
    () =>
      dealService.createDeal(11, {
        dealName: 'Steel supply',
        dealType: 'supply',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Open deal limit reached \(2\)/);
      return true;
    }
  );

  assert.equal(state.poolConnectCalls, 1);
  assert.equal(state.beginCalls, 1);
  assert.equal(state.rollbackCalls, 1);
});

test('updateDeal rejects transition to open when max open deals limit is reached', async () => {
  const { dealService, state, AppError } = buildHarness({
    maxOpenPerCompany: 2,
    openDeals: 2,
    existingDeal: {
      id: 7,
      company_id: 14,
      status: 'closed',
    },
  });

  await assert.rejects(
    () => dealService.updateDeal(7, 14, { status: 'open' }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Open deal limit reached \(2\)/);
      return true;
    }
  );

  assert.equal(state.countOpenCalls, 1);
  assert.equal(state.poolConnectCalls, 1);
  assert.equal(state.beginCalls, 1);
  assert.equal(state.rollbackCalls, 1);
  assert.equal(state.updateCalls, 0);
});

test('updateDeal allows transition to open when under the max open deals limit', async () => {
  const { dealService, state } = buildHarness({
    maxOpenPerCompany: 2,
    openDeals: 1,
    existingDeal: {
      id: 9,
      company_id: 14,
      status: 'closed',
    },
    updatedDeal: {
      id: 9,
      company_id: 14,
      deal_name: 'Reopened deal',
      deal_description: null,
      deal_value: null,
      deal_type: 'supply',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  const result = await dealService.updateDeal(9, 14, { status: 'open' });

  assert.equal(result.status, 'open');
  assert.equal(state.countOpenCalls, 1);
  assert.equal(state.poolConnectCalls, 1);
  assert.equal(state.beginCalls, 1);
  assert.equal(state.commitCalls, 1);
  assert.equal(state.updateCalls, 1);
});

test('updateDeal does not re-check limit when status is unchanged', async () => {
  const { dealService, state } = buildHarness({
    maxOpenPerCompany: 2,
    openDeals: 99,
    existingDeal: {
      id: 10,
      company_id: 20,
      status: 'open',
    },
    updatedDeal: {
      id: 10,
      company_id: 20,
      deal_name: 'Edited while open',
      deal_description: 'desc',
      deal_value: null,
      deal_type: 'supply',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  const result = await dealService.updateDeal(10, 20, { dealName: 'Edited while open' });

  assert.equal(result.dealName, 'Edited while open');
  assert.equal(state.countOpenCalls, 0);
  assert.equal(state.updateCalls, 1);
});
