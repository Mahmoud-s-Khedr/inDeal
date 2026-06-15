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
  hasExistingDealRequest = false,
  dealOwnerCompanyId = 20,
  dealOwnerHasEmail = true,
  dealStatus = 'open',
  createRequestError = null,
  requestLookupRow = null,
} = {}) => {
  class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }

  const state = {
    listFilters: null,
    countFilters: null,
    dealListFilters: null,
    dealCountFilters: null,
    statsFilters: null,
    incomingListFilters: null,
    incomingCountFilters: null,
    createdRequestPayload: null,
    sentEmails: [],
    dealStatusUpdates: [],
    updatedRequestStatuses: [],
    updatedRequestPayloads: [],
    supplyUpserts: [],
    demandUpserts: [],
    attachmentReplacements: [],
  };

  const now = new Date().toISOString();

  const requestRow = {
    id: 100,
    deal_id: null,
    applicant_company_id: 10,
    target_company_id: 20,
    request_kind: 'supply',
    request_type: 'direct',
    request_details: 'Direct request: Copper wire',
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
  const requestById = requestLookupRow || {
    ...requestRow,
    id: 77,
    deal_id: 1,
    target_company_id: null,
    request_type: 'inSupply',
  };

  const client = {
    query: async () => ({ rows: [] }),
    release: () => {},
  };

  const dealRequestRepository = {
    findExistingDirectRequest: async () => (hasExistingDirect ? { id: 9 } : null),
    findExistingRequest: async () => (hasExistingDealRequest ? { id: 8 } : null),
    createRequest: async (_client, payload) => {
      if (createRequestError) {
        throw createRequestError;
      }
      state.createdRequestPayload = payload;
      return {
        ...requestRow,
        deal_id: payload.dealId ?? null,
        applicant_company_id: payload.applicantCompanyId,
        target_company_id: payload.targetCompanyId ?? null,
        request_kind: payload.requestType === 'inDemand' ? 'demand' : 'supply',
        request_type: payload.requestType,
        request_details: payload.requestDetails,
        request_offer: payload.requestOffer ?? null,
        status: payload.status || 'pending',
      };
    },
    findByApplicantCompanyId: async (_companyId, filters) => {
      state.listFilters = filters;
      return [];
    },
    countByApplicantCompanyId: async (_companyId, filters) => {
      state.countFilters = filters;
      return 0;
    },
    findByDealId: async (_dealId, filters) => {
      state.dealListFilters = filters;
      return [];
    },
    countByDealId: async (_dealId, filters) => {
      state.dealCountFilters = filters;
      return 0;
    },
    getRequestStats: async (_dealId, filters) => {
      state.statsFilters = filters;
      return {
        total: '0',
        pending: '0',
        paused: '0',
        accepted: '0',
        rejected: '0',
        canceled: '0',
        lowest_offer: null,
        highest_offer: null,
        average_offer: null,
      };
    },
    findIncomingDirectRequestsByTargetCompanyId: async (_companyId, filters) => {
      state.incomingListFilters = filters;
      return [];
    },
    countIncomingDirectRequestsByTargetCompanyId: async (_companyId, filters) => {
      state.incomingCountFilters = filters;
      return 0;
    },
    findById: async () => requestById,
    updateStatus: async (requestId, status) => {
      state.updatedRequestStatuses.push({ requestId, status });
      return {
        ...requestById,
        id: requestId,
        status,
        updated_at: now,
      };
    },
    updateRequest: async (requestId, payload) => {
      state.updatedRequestPayloads.push({ requestId, payload });
      return {
        ...requestById,
        id: requestId,
        request_details: payload.requestDetails,
        request_offer: payload.requestOffer,
        updated_at: now,
      };
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
    [resolveFromDealService('../../../infrastructure/config/storage')]: {
      publicUrl: 'https://files.example.com',
    },
    [resolveFromDealService('../repository/deal.repository')]: {
      findById: async (id) =>
        id === 999
          ? null
          : {
              id,
              company_id: dealOwnerCompanyId,
              deal_name: `Deal ${id}`,
              status: dealStatus,
            },
      countOpenByCompanyId: async () => 0,
      updateStatus: async (dealId, status) => {
        state.dealStatusUpdates.push({ dealId, status });
        return { id: dealId, status };
      },
    },
    [resolveFromDealService('../repository/dealRequest.repository')]: dealRequestRepository,
    [resolveFromDealService('../repository/dealAttachment.repository')]: {
      listByDealIds: async () => [],
      replaceForDeal: async () => {},
    },
    [resolveFromDealService('../repository/dealRequestDetails.repository')]: {
      upsertSupplyDetails: async (_client, requestId, details) => {
        state.supplyUpserts.push({ requestId, details });
      },
      upsertDemandDetails: async (_client, requestId, details) => {
        state.demandUpserts.push({ requestId, details });
      },
      replaceRequestAttachments: async (_client, requestId, attachments) => {
        state.attachmentReplacements.push({ requestId, attachments });
      },
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
      repository: {
        fileRepository: {
          findByIds: async (ids) =>
            ids.map((id) => ({ id, filePath: `uploads/${id}.png`, deletedAt: null })),
        },
      },
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

test('createDealRequest derives requestOffer from supplyDetails.targetPrice', async () => {
  const { dealService, state } = buildHarness();

  await dealService.createDealRequest(1, 10, {
    requestType: 'inSupply',
    supplyDetails: {
      productServiceName: 'Copper wire',
      category: 'rawMaterial',
      targetPrice: 1450,
    },
    attachments: [],
  });

  assert.equal(state.createdRequestPayload.requestOffer, 1450);
});

test('createDealRequest persists demand details for inDemand requests', async () => {
  const { dealService, state } = buildHarness();

  const result = await dealService.createDealRequest(1, 10, {
    requestType: 'inDemand',
    demandDetails: {
      productServiceName: 'Industrial resin',
      availableQuantity: 100,
      unitPrice: 50,
      currency: 'USD',
      certificationsHeld: 'ISO 9001',
      warrantyPolicy: '12 months',
      returnPolicy: 'Returns within 14 days',
    },
    attachments: [],
  });

  assert.equal(result.requestType, 'inDemand');
  assert.equal(state.createdRequestPayload.requestType, 'inDemand');
  assert.equal(state.createdRequestPayload.requestOffer, 50);
  assert.equal(state.demandUpserts.length, 1);
  assert.equal(state.supplyUpserts.length, 0);
  assert.equal(state.demandUpserts[0].details.productServiceName, 'Industrial resin');
});

test('createDirectRequest allows repeated direct requests between the same companies', async () => {
  const { dealService, state } = buildHarness({ hasExistingDirect: true });

  const result = await dealService.createDirectRequest(10, {
    targetCompanyId: 20,
    supplyDetails: {
      productServiceName: 'Copper wire',
      category: 'rawMaterial',
    },
  });

  assert.equal(state.createdRequestPayload.targetCompanyId, 20);
  assert.equal(result.requestType, 'direct');
});

test('getMyRequests is canonical outgoing history and getMyApplications remains a filtered alias', async () => {
  const { dealService, state } = buildHarness();

  const requests = await dealService.getMyRequests(10, {});
  assert.equal(requests.pagination.total, 0);
  assert.equal(requests.items.length, 0);
  assert.equal(state.listFilters.requestType, undefined);
  assert.deepEqual(state.listFilters.requestTypes, ['direct', 'inSupply']);

  const applications = await dealService.getMyApplications(10, {});
  assert.equal(applications.pagination.total, 0);
  assert.equal(applications.items.length, 0);
  assert.equal(state.listFilters.requestType, 'inDemand');
  assert.equal(state.listFilters.requestTypes, undefined);
});

test('getMyRequests accepts narrowing requestType filters', async () => {
  const { dealService, state } = buildHarness();

  await dealService.getMyRequests(10, { requestType: 'direct' });
  assert.equal(state.listFilters.requestType, 'direct');
  assert.deepEqual(state.listFilters.requestTypes, ['direct', 'inSupply']);

  await dealService.getMyRequests(10, { requestType: 'inSupply' });
  assert.equal(state.listFilters.requestType, 'inSupply');
  assert.deepEqual(state.listFilters.requestTypes, ['direct', 'inSupply']);
});

test('getDealRequests applies requestType filter consistently to list, count, and stats', async () => {
  const { dealService, state } = buildHarness();

  const result = await dealService.getDealRequests(1, 20, { requestType: 'inDemand' });

  assert.equal(result.pagination.total, 0);
  assert.deepEqual(state.dealListFilters, { requestType: 'inDemand' });
  assert.deepEqual(state.dealCountFilters, { requestType: 'inDemand' });
  assert.deepEqual(state.statsFilters, { requestType: 'inDemand' });
});

test('getMyDirectRequests lists incoming direct requests by target company', async () => {
  const { dealService, state } = buildHarness();

  const requests = await dealService.getMyDirectRequests(10, {});
  assert.equal(requests.pagination.total, 0);
  assert.equal(requests.items.length, 0);
  assert.deepEqual(state.incomingListFilters, {});
  assert.deepEqual(state.incomingCountFilters, {});
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
  assert.match(state.sentEmails[0].html, /New message on your deal/);
});

test('createDealRequest does not send owner notification email', async () => {
  const { dealService, state } = buildHarness();

  await dealService.createDealRequest(1, 10, {
    requestType: 'inSupply',
    supplyDetails: {
      productServiceName: 'Copper wire',
      category: 'rawMaterial',
    },
    attachments: [],
  });

  assert.equal(state.sentEmails.length, 0);
});

test('createDealRequest rejects negotiating deals after SRS alignment', async () => {
  const { dealService, AppError } = buildHarness({ dealStatus: 'negotiating' });

  await assert.rejects(
    () =>
      dealService.createDealRequest(1, 10, {
        requestType: 'inSupply',
        supplyDetails: {
          productServiceName: 'Copper wire',
          category: 'rawMaterial',
        },
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /not open for requests/);
      return true;
    }
  );
});

test('createDealRequest maps DB unique constraint violations to duplicate request error', async () => {
  const { dealService, AppError } = buildHarness({
    createRequestError: {
      code: '23505',
      constraint: 'uq_deal_requests_active_in_supply',
    },
  });

  await assert.rejects(
    () =>
      dealService.createDealRequest(1, 10, {
        requestType: 'inSupply',
        supplyDetails: {
          productServiceName: 'Copper wire',
          category: 'rawMaterial',
        },
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /already have a request on this deal/);
      return true;
    }
  );
});

test('updateRequestStatus no longer mutates deal status on acceptance', async () => {
  const { dealService, state } = buildHarness();

  const result = await dealService.updateRequestStatus(1, 77, 20, 'accepted');

  assert.equal(result.status, 'accepted');
  assert.deepEqual(state.updatedRequestStatuses, [{ requestId: 77, status: 'accepted' }]);
  assert.deepEqual(state.dealStatusUpdates, []);
});

test('updateRequest updates sender-owned pending inSupply request', async () => {
  const { dealService, state } = buildHarness();

  const result = await dealService.updateRequest(77, 10, {
    supplyDetails: {
      productServiceName: 'Copper wire',
      category: 'rawMaterial',
      targetPrice: 1450,
    },
    attachments: [{ fileId: 5, sortOrder: 0 }],
  });

  assert.equal(result.requestOffer, 1450);
  assert.equal(state.updatedRequestPayloads.length, 1);
  assert.equal(state.updatedRequestPayloads[0].payload.requestOffer, 1450);
  assert.equal(state.supplyUpserts.length, 1);
  assert.equal(state.demandUpserts.length, 0);
  assert.deepEqual(state.attachmentReplacements[0].attachments, [{ fileId: 5, sortOrder: 0 }]);
});

test('updateRequest rejects non-owner callers', async () => {
  const { dealService, AppError } = buildHarness();

  await assert.rejects(
    () =>
      dealService.updateRequest(77, 99, {
        supplyDetails: {
          productServiceName: 'Copper wire',
          category: 'rawMaterial',
        },
        attachments: [],
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 403);
      assert.match(error.message, /Unauthorized/);
      return true;
    }
  );
});

test('updateRequest rejects non-editable statuses', async () => {
  const { dealService, AppError } = buildHarness({
    requestLookupRow: {
      id: 77,
      deal_id: 1,
      applicant_company_id: 10,
      target_company_id: null,
      request_type: 'inSupply',
      request_details: 'Supply request: Copper wire',
      request_offer: 1200,
      status: 'accepted',
    },
  });

  await assert.rejects(
    () =>
      dealService.updateRequest(77, 10, {
        supplyDetails: {
          productServiceName: 'Copper wire',
          category: 'rawMaterial',
        },
        attachments: [],
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Only pending or paused requests can be updated/);
      return true;
    }
  );
});

test('updateRequest rejects detail type mutation attempts', async () => {
  const { dealService, AppError } = buildHarness({
    requestLookupRow: {
      id: 77,
      deal_id: null,
      applicant_company_id: 10,
      target_company_id: 20,
      request_type: 'direct',
      request_details: 'Direct request: Copper wire',
      request_offer: 1200,
      status: 'pending',
    },
  });

  await assert.rejects(
    () =>
      dealService.updateRequest(77, 10, {
        supplyDetails: {
          productServiceName: 'Copper wire',
          category: 'rawMaterial',
        },
        demandDetails: {
          productServiceName: 'Copper wire',
        },
        attachments: [],
      }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /demandDetails is not allowed for direct requests/);
      return true;
    }
  );
});
