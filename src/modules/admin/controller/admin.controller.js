const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const adminService = require('../service/admin.service');

const listCompanyReviewRequests = catchAsync(async (_req, res) => {
  const items = await adminService.listCompanyReviewRequests();
  sendResponse(res, 200, items, 'Company review requests fetched');
});

const getCompanyReviewRequest = catchAsync(async (req, res) => {
  const item = await adminService.getCompanyReviewRequest(req.params.companyId);
  sendResponse(res, 200, item, 'Company review request fetched');
});

const updateCompanyReviewRequest = catchAsync(async (req, res) => {
  const item = await adminService.updateCompanyReviewRequest(req.params.companyId, req.body);
  sendResponse(res, 200, item, 'Company review request updated');
});

module.exports = {
  listCompanyReviewRequests,
  getCompanyReviewRequest,
  updateCompanyReviewRequest,
};
