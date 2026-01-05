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

const updateCompany = catchAsync(async (req, res) => {
    const updated = await adminCompanyService.updateCompany(req.params.id, req.body);
    sendResponse(res, 200, updated, 'Company updated');
});

const updateCompanySummary = catchAsync(async (req, res) => {
    const updated = await adminCompanyService.updateCompanySummary(req.params.id, req.body.summary);
    sendResponse(res, 200, updated, 'Company summary updated');
});

const listCompanyReviews = catchAsync(async (req, res) => {
    const reviews = await adminCompanyService.listCompanyReviews(req.params.id);
    sendResponse(res, 200, reviews, 'Company reviews fetched');
});

const listCompanyGallery = catchAsync(async (req, res) => {
    const gallery = await adminCompanyService.listCompanyGallery(req.params.id);
    sendResponse(res, 200, gallery, 'Company gallery fetched');
});

const createCompanyGalleryItem = catchAsync(async (req, res) => {
    const item = await adminCompanyService.createCompanyGalleryItem(req.params.id, req.body);
    sendResponse(res, 201, item, 'Company gallery item created');
});

const updateCompanyGalleryItem = catchAsync(async (req, res) => {
    const item = await adminCompanyService.updateCompanyGalleryItem(req.params.id, req.params.galleryItemId, req.body);
    sendResponse(res, 200, item, 'Company gallery item updated');
});

const deleteCompanyGalleryItem = catchAsync(async (req, res) => {
    const item = await adminCompanyService.deleteCompanyGalleryItem(req.params.id, req.params.galleryItemId);
    sendResponse(res, 200, item, 'Company gallery item deleted');
});

const listCompanyDocuments = catchAsync(async (req, res) => {
    const docs = await adminCompanyService.listCompanyDocuments(req.params.id);
    sendResponse(res, 200, docs, 'Company documents fetched');
});

const createCompanyDocument = catchAsync(async (req, res) => {
    const doc = await adminCompanyService.createCompanyDocument(req.params.id, req.body);
    sendResponse(res, 201, doc, 'Company document created');
});

const updateCompanyDocument = catchAsync(async (req, res) => {
    const doc = await adminCompanyService.updateCompanyDocument(req.params.id, req.params.documentId, req.body);
    sendResponse(res, 200, doc, 'Company document updated');
});

const deleteCompanyDocument = catchAsync(async (req, res) => {
    const doc = await adminCompanyService.deleteCompanyDocument(req.params.id, req.params.documentId);
    sendResponse(res, 200, doc, 'Company document deleted');
});

const listCompanyContributions = catchAsync(async (req, res) => {
    const items = await adminCompanyService.listCompanyContributions(req.params.id);
    sendResponse(res, 200, items, 'Company contributions fetched');
});

const createCompanyContribution = catchAsync(async (req, res) => {
    const item = await adminCompanyService.createCompanyContribution(req.params.id, req.body);
    sendResponse(res, 201, item, 'Company contribution created');
});

const updateCompanyContribution = catchAsync(async (req, res) => {
    const item = await adminCompanyService.updateCompanyContribution(
        req.params.id,
        req.params.contributionId,
        req.body
    );
    sendResponse(res, 200, item, 'Company contribution updated');
});

const deleteCompanyContribution = catchAsync(async (req, res) => {
    const item = await adminCompanyService.deleteCompanyContribution(req.params.id, req.params.contributionId);
    sendResponse(res, 200, item, 'Company contribution deleted');
});

module.exports = {
    listPendingCompanies,
    listCompanies,
    getCompanyDetail,
    updateCompany,
    updateCompanySummary,
    reviewCompanyStatus,
    approveCompany,
    rejectCompany,
    changeCompanyAgent,
    listCompanyReviews,
    listCompanyGallery,
    createCompanyGalleryItem,
    updateCompanyGalleryItem,
    deleteCompanyGalleryItem,
    listCompanyDocuments,
    createCompanyDocument,
    updateCompanyDocument,
    deleteCompanyDocument,
    listCompanyContributions,
    createCompanyContribution,
    updateCompanyContribution,
    deleteCompanyContribution,
};
