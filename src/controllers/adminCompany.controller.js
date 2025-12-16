const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const adminCompanyService = require('../services/adminCompany.service');

const listPendingCompanies = catchAsync(async (req, res) => {
    const result = await adminCompanyService.listPendingCompanies();
    sendResponse(res, 200, result, 'Pending companies fetched');
});

const listCompanies = catchAsync(async (req, res) => {
    const result = await adminCompanyService.listAllCompanies();
    sendResponse(res, 200, result, 'Companies fetched');
});

const getCompanyDetail = catchAsync(async (req, res) => {
    const detail = await adminCompanyService.getCompanyDetail(req.params.id);
    sendResponse(res, 200, detail, 'Company details fetched');
});

const reviewCompanyStatus = catchAsync(async (req, res) => {
    const updated = await adminCompanyService.reviewCompanyStatus(req.params.id, req.body.status);
    sendResponse(res, 200, updated, 'Company status updated');
});

const approveCompany = catchAsync(async (req, res) => {
    const updated = await adminCompanyService.approveCompany(req.params.id);
    sendResponse(res, 200, updated, 'Company approved');
});

const rejectCompany = catchAsync(async (req, res) => {
    const updated = await adminCompanyService.rejectCompany(req.params.id);
    sendResponse(res, 200, updated, 'Company rejected');
});

const changeCompanyAgent = catchAsync(async (req, res) => {
    const updated = await adminCompanyService.changeCompanyAgent(req.params.id, req.body.agentId);
    sendResponse(res, 200, updated, 'Company agent updated');
});

module.exports = {
    listPendingCompanies,
    listCompanies,
    getCompanyDetail,
    reviewCompanyStatus,
    approveCompany,
    rejectCompany,
    changeCompanyAgent,
};
