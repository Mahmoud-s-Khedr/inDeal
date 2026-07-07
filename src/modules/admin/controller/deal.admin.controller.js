const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const { dealAdminService } = require('../service');

const listDeals = catchAsync(async (req, res) => {
  const result = await dealAdminService.listDeals(req.query);
  sendResponse(res, 200, result, 'Deals fetched successfully');
});

const getDealById = catchAsync(async (req, res) => {
  const result = await dealAdminService.getDealById(Number(req.params.id));
  sendResponse(res, 200, result, 'Deal fetched successfully');
});

const updateDealStatus = catchAsync(async (req, res) => {
  const result = await dealAdminService.updateDealStatus(Number(req.params.id), req.body);
  sendResponse(res, 200, result, 'Deal status updated successfully');
});

module.exports = {
  listDeals,
  getDealById,
  updateDealStatus,
};
