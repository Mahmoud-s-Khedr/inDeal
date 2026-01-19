const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const dealService = require('../services/deal.service');

// ─────────────────────────────────────────────────────────────
// DEAL CONTROLLERS
// ─────────────────────────────────────────────────────────────

const createDeal = catchAsync(async (req, res) => {
  const deal = await dealService.createDeal(req.user.company.id, req.body);
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
  const deals = await dealService.getMyDeals(req.user.company.id, req.query);
  sendResponse(res, 200, deals, 'My deals fetched');
});

const updateDeal = catchAsync(async (req, res) => {
  const deal = await dealService.updateDeal(req.params.id, req.user.company.id, req.body);
  sendResponse(res, 200, deal, 'Deal updated successfully');
});

const archiveDeal = catchAsync(async (req, res) => {
  const deal = await dealService.archiveDeal(req.params.id, req.user.company.id);
  sendResponse(res, 200, deal, 'Deal archived successfully');
});

// ─────────────────────────────────────────────────────────────
// DEAL REQUEST CONTROLLERS
// ─────────────────────────────────────────────────────────────

const createDealRequest = catchAsync(async (req, res) => {
  const request = await dealService.createDealRequest(req.params.id, req.user.company.id, req.body);
  sendResponse(res, 201, request, 'Request submitted successfully');
});

const getDealRequests = catchAsync(async (req, res) => {
  const result = await dealService.getDealRequests(req.params.id, req.user.company.id, req.query);
  sendResponse(res, 200, result, 'Deal requests fetched');
});

const getMyRequests = catchAsync(async (req, res) => {
  const requests = await dealService.getMyRequests(req.user.company.id, req.query);
  sendResponse(res, 200, requests, 'My requests fetched');
});

const updateRequestStatus = catchAsync(async (req, res) => {
  const request = await dealService.updateRequestStatus(
    req.params.dealId,
    req.params.requestId,
    req.user.company.id,
    req.body.status
  );
  sendResponse(res, 200, request, `Request ${req.body.status}`);
});

const withdrawRequest = catchAsync(async (req, res) => {
  const request = await dealService.withdrawRequest(req.params.requestId, req.user.company.id);
  sendResponse(res, 200, request, 'Request withdrawn');
});

// ─────────────────────────────────────────────────────────────
// ADMIN CONTROLLERS
// ─────────────────────────────────────────────────────────────

const adminListDeals = catchAsync(async (req, res) => {
  const deals = await dealService.adminGetAllDeals(req.query);
  sendResponse(res, 200, deals, 'All deals fetched');
});

const adminGetDeal = catchAsync(async (req, res) => {
  const result = await dealService.adminGetDealDetails(req.params.id);
  sendResponse(res, 200, result, 'Deal details fetched');
});

const adminUpdateDealStatus = catchAsync(async (req, res) => {
  const deal = await dealService.adminUpdateDealStatus(req.params.id, req.body.status);
  sendResponse(res, 200, deal, 'Deal status updated');
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
  // Admin endpoints
  adminListDeals,
  adminGetDeal,
  adminUpdateDealStatus,
};
