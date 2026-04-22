const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const dealService = require('../services/deal.service');
const AppError = require('../utils/AppError');

const getCompanyId = (req) => {
  const companyId = req.user?.company?.id;
  if (!companyId) {
    throw new AppError('Company context required', 403);
  }
  return companyId;
};

// ─────────────────────────────────────────────────────────────
// DEAL CONTROLLERS
// ─────────────────────────────────────────────────────────────

const createDeal = catchAsync(async (req, res) => {
  const deal = await dealService.createDeal(getCompanyId(req), req.body);
  sendResponse(res, 201, deal, 'Deal created successfully');
});

const getDeal = catchAsync(async (req, res) => {
  const deal = await dealService.getDealById(req.params.id);
  sendResponse(res, 200, deal, 'Deal details fetched');
});

const searchDeals = catchAsync(async (req, res) => {
  // Optionally exclude own company from search results
  const excludeCompanyId = req.user?.company?.id || null;
  const result = await dealService.searchDeals(req.query, excludeCompanyId);
  sendResponse(res, 200, result, 'Deals fetched');
});

const getMyDeals = catchAsync(async (req, res) => {
  const deals = await dealService.getMyDeals(getCompanyId(req), req.query);
  sendResponse(res, 200, deals, 'My deals fetched');
});

const updateDeal = catchAsync(async (req, res) => {
  const deal = await dealService.updateDeal(req.params.id, getCompanyId(req), req.body);
  sendResponse(res, 200, deal, 'Deal updated successfully');
});

const archiveDeal = catchAsync(async (req, res) => {
  const deal = await dealService.archiveDeal(req.params.id, getCompanyId(req));
  sendResponse(res, 200, deal, 'Deal archived successfully');
});

// ─────────────────────────────────────────────────────────────
// DEAL REQUEST CONTROLLERS
// ─────────────────────────────────────────────────────────────

const createDealRequest = catchAsync(async (req, res) => {
  const request = await dealService.createDealRequest(req.params.id, getCompanyId(req), req.body);
  sendResponse(res, 201, request, 'Request submitted successfully');
});

const getDealRequests = catchAsync(async (req, res) => {
  const result = await dealService.getDealRequests(req.params.id, getCompanyId(req), req.query);
  sendResponse(res, 200, result, 'Deal requests fetched');
});

const getMyRequests = catchAsync(async (req, res) => {
  const requests = await dealService.getMyRequests(getCompanyId(req), req.query);
  sendResponse(res, 200, requests, 'My requests fetched');
});

const updateRequestStatus = catchAsync(async (req, res) => {
  const request = await dealService.updateRequestStatus(
    req.params.dealId,
    req.params.requestId,
    getCompanyId(req),
    req.body.status
  );
  sendResponse(res, 200, request, `Request ${req.body.status}`);
});

const withdrawRequest = catchAsync(async (req, res) => {
  const request = await dealService.withdrawRequest(req.params.requestId, getCompanyId(req));
  sendResponse(res, 200, request, 'Request withdrawn');
});

module.exports = {
  // Deal endpoints
  createDeal,
  getDeal,
  searchDeals,
  getMyDeals,
  updateDeal,
  archiveDeal,
  // Request endpoints
  createDealRequest,
  getDealRequests,
  getMyRequests,
  updateRequestStatus,
  withdrawRequest,
};
