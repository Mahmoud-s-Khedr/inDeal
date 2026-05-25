require('../helpers/infraTeardown');
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
  targetCompanyActive = true,
  hasExistingDirect = false,
  dealOwnerCompanyId = 20,
  dealOwnerHasEmail = true,
} = {}) => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  const state = {
    listFilters: null,
    createdRequestPayload: null,
    sentEmails: [],
  };

  const now = new Date().toISOString();

  const requestRow = {
    id: 100,
    deal_id: null,
    applicant_company_id: 10,
    target_company_id: 20,
    request_kind: 'rfq',
    request_type: 'direct',
    request_details: 'Supply request: Copper wire',
    request_offer: null,
    status: 'pending',
    canceled_at: null,
    canceled_by_company_id: null,
    cancel_reason: null,
    paused_at: null,
    paused_by_company_id: null,
    created_at: now,
    updated_at: now,
  };

  const client = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };

  const dealRequestRepository = {
    findExistingDirectRequest: async () => (hasExistingDirect ? { id: 9 } : null),
    findExistingRequest: async () => null,
    createRequest: async (_client, payload) => {
      state.createdRequestPayload = payload;
      return requestRow;
    },
    findByApplicantCompanyId: async (_companyId, filters) => {
      state.listFilters = filters;
      return [];
    },
  };

  const mocks = {
    [resolveFromDealService('../../../core/errors/AppError')]: AppError,
    [resolveFromDealService('../../../infrastructure/config/db')]: {
      pool: { connect: async () => client },
    },
    [resolveFromDealService('../../../infrastructure/config/env')]: {
      deals: { maxOpenPerCompany: 5 },
      companyReview: {},
    },
    [resolveFromDealService('../repository/deal.repository')]: {
      findById: async (id) =>
        id === 999
          ? null
          : {
              id,
              company_id: dealOwnerCompanyId,
              deal_name: `Deal ${id}`,
              status: 'open',
            },
      countOpenByCompanyId: async () => 0,
    },
    [resolveFromDealService('../repository/dealRequest.repository')]: dealRequestRepository,
    [resolveFromDealService('../repository/dealAttachment.repository')]: {
      listByDealIds: async () => [],
      replaceForDeal: async () => {},
    },
    [resolveFromDealService('../repository/dealRequestDetails.repository')]: {
      upsertSupplyDetails: async () => {},
      upsertDemandDetails: async () => {},
      replaceRequestAttachments: async () => {},
      getSupplyDetailsByRequestIds: async () => [],
      getDemandDetailsByRequestIds: async () => [],
      getAttachmentsByRequestIds: async () => [],
    },
    [resolveFromDealService('../../company')]: {
      repository: {
        companyRepository: {
          findById: async (id) => {
            if (id === dealOwnerCompanyId) {
              return {
                id,
                status: id === 20 ? (targetCompanyActive ? 'active' : 'underReview') : 'active',
                name: `Company ${id}`,
                email: dealOwnerHasEmail ? `owner${id}@example.com` : null,
              };
            }
            if (id === 20) return { id, status: targetCompanyActive ? 'active' : 'underReview' };
            return {
              id,
              status: 'active',
              name: `Company ${id}`,
              email: `company${id}@example.com`,
            };
          },
          findByIdWithAgentEmail: async (id) => {
            if (id !== dealOwnerCompanyId) return null;
            return {
              id,
              status: 'active',
              name: `Company ${id}`,
              agent_email: dealOwnerHasEmail ? `owner-agent${id}@example.com` : null,
            };
          },
        },
      },
    },
    [resolveFromDealService('../../file')]: {
      repository: { fileRepository: { findByIds: async () => [] } },
      service: { getFileById: async () => null },
    },
    [resolveFromDealService('../../../infrastructure/config/mailer')]: {
      sendMail: async (payload) => {
        state.sentEmails.push(payload);
        return { id: 'test-message-id' };
      },
    },
    [resolveFromDealService('../../../shared/utils/logger')]: {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    },
  };

  return { dealService: loadDealServiceWithMocks(mocks), state, AppError };
};

test('createDirectRequest creates direct request with expected repository payload', async () => {
  const { dealService, state } = buildHarness();

  const result = await dealService.createDirectRequest(10, {
    targetCompanyId: 20,
    requestKind: 'rfq',
    requestType: 'direct',
    supplyDetails: {
      productServiceName: 'Copper wire',
      category: 'rawMaterial',
    },
    attachments: [],
  });

  assert.equal(state.createdRequestPayload.dealId, null);
  assert.equal(state.createdRequestPayload.requestType, 'direct');
  assert.equal(state.createdRequestPayload.targetCompanyId, 20);
  assert.equal(result.requestType, 'direct');
  assert.equal(result.targetCompanyId, 20);
});

test('createDirectRequest rejects duplicate active direct request', async () => {
  const { dealService, AppError } = buildHarness({ hasExistingDirect: true });

  await assert.rejects(
    () =>
      dealService.createDirectRequest(10, {
        targetCompanyId: 20,
        requestKind: 'rfq',
        requestType: 'direct',
        supplyDetails: {
          productServiceName: 'Copper wire',
          category: 'rawMaterial',
        },
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /active direct request/);
      return true;
    }
  );
});

test('getMyRequests and getMyApplications pass segmentation filters', async () => {
  const { dealService, state } = buildHarness();

  await dealService.getMyRequests(10, {});
  assert.deepEqual(state.listFilters.requestKinds, ['supply', 'rfq']);
  assert.equal(state.listFilters.includeDirect, true);

  await dealService.getMyApplications(10, {});
  assert.deepEqual(state.listFilters.requestKinds, ['demand']);
  assert.equal(state.listFilters.requestType, 'inSupply');
  assert.equal(state.listFilters.includeDirect, false);
});

test('sendDealEmail rejects when deal is not found', async () => {
  const { dealService, AppError } = buildHarness();

  await assert.rejects(
    () =>
      dealService.sendDealEmail(10, {
        dealId: 999,
        subject: 'Follow up',
        message: 'Please check details.',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      assert.match(error.message, /Deal not found/);
      return true;
    }
  );
});

test('sendDealEmail rejects sending to own deal', async () => {
  const { dealService, AppError } = buildHarness({ dealOwnerCompanyId: 10 });

  await assert.rejects(
    () =>
      dealService.sendDealEmail(10, {
        dealId: 1,
        subject: 'Follow up',
        message: 'Please check details.',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /own deal/i);
      return true;
    }
  );
});

test('sendDealEmail rejects when owner has no email', async () => {
  const { dealService, AppError } = buildHarness({ dealOwnerHasEmail: false });

  await assert.rejects(
    () =>
      dealService.sendDealEmail(10, {
        dealId: 1,
        subject: 'Follow up',
        message: 'Please check details.',
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /agent does not have an email/i);
      return true;
    }
  );
});

test('sendDealEmail sends formatted email to deal owner', async () => {
  const { dealService, state } = buildHarness();

  await dealService.sendDealEmail(10, {
    dealId: 1,
    subject: 'Need quotation',
    message: 'Can you share MOQ and lead time?\nThanks',
    contactInfo: 'buyer@example.com',
  });

  assert.equal(state.sentEmails.length, 1);
  assert.equal(state.sentEmails[0].to, 'owner-agent20@example.com');
  assert.match(state.sentEmails[0].subject, /Need quotation/);
  assert.match(state.sentEmails[0].text, /buyer@example.com/);
  assert.match(state.sentEmails[0].html, /New Deal Message/);
});

test('createDealRequest does not send owner notification email', async () => {
  const { dealService, state } = buildHarness();

  await dealService.createDealRequest(1, 10, {
    requestKind: 'rfq',
    supplyDetails: {
      productServiceName: 'Copper wire',
      category: 'rawMaterial',
    },
    attachments: [],
  });

  assert.equal(state.sentEmails.length, 0);
});
