const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const { companyAdminService } = require('../service');

const listCompanies = catchAsync(async (req, res) => {
  const result = await companyAdminService.listCompanies(req.query);
  sendResponse(res, 200, result, 'Companies fetched successfully');
});

const getCompanyById = catchAsync(async (req, res) => {
  const result = await companyAdminService.getCompanyById(Number(req.params.id));
  sendResponse(res, 200, result, 'Company fetched successfully');
});

const updateCompanyStatus = catchAsync(async (req, res) => {
  const result = await companyAdminService.updateCompanyStatus(Number(req.params.id), req.body);
  sendResponse(res, 200, result, 'Company status updated successfully');
});

module.exports = {
  listCompanies,
  getCompanyById,
  updateCompanyStatus,
};
