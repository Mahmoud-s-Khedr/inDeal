const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const { analyticsAdminService } = require('../service');

const getOverview = catchAsync(async (req, res) => {
  const result = await analyticsAdminService.getOverview();
  sendResponse(res, 200, result, 'Analytics overview fetched successfully');
});

const getRegistrations = catchAsync(async (req, res) => {
  const result = await analyticsAdminService.getRegistrations(req.query.period);
  sendResponse(res, 200, result, 'Registration analytics fetched successfully');
});

const getDeals = catchAsync(async (req, res) => {
  const result = await analyticsAdminService.getDeals(req.query.period);
  sendResponse(res, 200, result, 'Deal analytics fetched successfully');
});

const getRequests = catchAsync(async (req, res) => {
  const result = await analyticsAdminService.getRequests(req.query.period);
  sendResponse(res, 200, result, 'Request analytics fetched successfully');
});

module.exports = {
  getOverview,
  getRegistrations,
  getDeals,
  getRequests,
};
