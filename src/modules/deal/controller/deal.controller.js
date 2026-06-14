const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const dealService = require('../service/deal.service');
const AppError = require('../../../core/errors/AppError');

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

const createDirectRequest = catchAsync(async (req, res) => {
  const request = await dealService.createDirectRequest(getCompanyId(req), req.body);
  sendResponse(res, 201, request, 'Direct request submitted successfully');
});

const getDealRequests = catchAsync(async (req, res) => {
  const result = await dealService.getDealRequests(req.params.id, getCompanyId(req), req.query);
  sendResponse(res, 200, result, 'Deal requests fetched');
});

const getMyRequests = catchAsync(async (req, res) => {
  const requests = await dealService.getMyRequests(getCompanyId(req), req.query);
  sendResponse(res, 200, requests, 'My requests fetched');
});

const getMyApplications = catchAsync(async (req, res) => {
  const applications = await dealService.getMyApplications(getCompanyId(req), req.query);
  sendResponse(res, 200, applications, 'My applications fetched');
});

const getMyDirectRequests = catchAsync(async (req, res) => {
  const requests = await dealService.getMyDirectRequests(getCompanyId(req), req.query);
  sendResponse(res, 200, requests, 'My direct requests fetched');
});

const updateRequest = catchAsync(async (req, res) => {
  const request = await dealService.updateRequest(
    req.params.requestId,
    getCompanyId(req),
    req.body
  );
  sendResponse(res, 200, request, 'Request updated successfully');
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
  const cancelReason = req.body?.cancelReason || req.query?.cancelReason;
  const request = await dealService.withdrawRequest(
    req.params.requestId,
    getCompanyId(req),
    cancelReason
  );
  sendResponse(res, 200, request, 'Request withdrawn');
});

const pauseRequest = catchAsync(async (req, res) => {
  const request = await dealService.pauseRequest(req.params.requestId, getCompanyId(req));
  sendResponse(res, 200, request, 'Request paused');
});

const cancelRequest = catchAsync(async (req, res) => {
  const request = await dealService.cancelRequest(
    req.params.requestId,
    getCompanyId(req),
    req.body.cancelReason
  );
  sendResponse(res, 200, request, 'Request canceled');
});

const sendDealEmail = catchAsync(async (req, res) => {
  await dealService.sendDealEmail(getCompanyId(req), req.body);
  sendResponse(res, 200, null, 'Email sent successfully');
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
  createDirectRequest,
  createDealRequest,
  getDealRequests,
  getMyRequests,
  getMyApplications,
  getMyDirectRequests,
  updateRequest,
  updateRequestStatus,
  pauseRequest,
  cancelRequest,
  withdrawRequest,
  sendDealEmail,
};
