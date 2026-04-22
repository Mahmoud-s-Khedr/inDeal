const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const companyService = require('../service/company.service');

const getMyProfile = catchAsync(async (req, res) => {
  const profile = await companyService.getMyProfile(req.user.id);
  sendResponse(res, 200, profile, 'Company profile fetched');
});

const updateMyProfile = catchAsync(async (req, res) => {
  const company = await companyService.updateMyProfile(req.user.id, req.body);
  sendResponse(res, 200, { company }, 'Company profile updated');
});

const getCompanyProfile = catchAsync(async (req, res) => {
  const profile = await companyService.getCompanyProfile(req.params.id);
  sendResponse(res, 200, profile, 'Company profile fetched');
});

const addGalleryItem = catchAsync(async (req, res) => {
  const item = await companyService.addGalleryItem(req.user.id, req.body);
  sendResponse(res, 201, item, 'Gallery item added');
});

const listGallery = catchAsync(async (req, res) => {
  const gallery = await companyService.listGallery(req.params.id);
  sendResponse(res, 200, gallery, 'Gallery items fetched');
});

const listReviews = catchAsync(async (req, res) => {
  const reviews = await companyService.listReviews(req.params.id);
  sendResponse(res, 200, reviews, 'Company reviews fetched');
});

const searchCompanies = catchAsync(async (req, res) => {
  const result = await companyService.searchCompanies(req.query);
  sendResponse(res, 200, result, 'Companies fetched');
});

const createReview = catchAsync(async (req, res) => {
  const review = await companyService.createReview(req.user.id, req.params.id, req.body);
  sendResponse(res, 201, review, 'Review submitted');
});

const resendForReview = catchAsync(async (req, res) => {
  const result = await companyService.resendForReview(req.user.id);
  sendResponse(res, 200, result, 'Company submitted for review');
});

const listMyGallery = catchAsync(async (req, res) => {
  const gallery = await companyService.listMyGallery(req.user.id);
  sendResponse(res, 200, gallery, 'Gallery items fetched');
});

const updateMyGalleryItem = catchAsync(async (req, res) => {
  const item = await companyService.updateMyGalleryItem(
    req.user.id,
    req.params.galleryItemId,
    req.body
  );
  sendResponse(res, 200, item, 'Gallery item updated');
});

const deleteMyGalleryItem = catchAsync(async (req, res) => {
  const item = await companyService.deleteMyGalleryItem(req.user.id, req.params.galleryItemId);
  sendResponse(res, 200, item, 'Gallery item deleted');
});

const listMyDocuments = catchAsync(async (req, res) => {
  const docs = await companyService.listMyDocuments(req.user.id);
  sendResponse(res, 200, docs, 'Company documents fetched');
});

const createMyDocument = catchAsync(async (req, res) => {
  const doc = await companyService.createMyDocument(req.user.id, req.body);
  sendResponse(res, 201, doc, 'Company document created');
});

const listMyRegistrationDocuments = catchAsync(async (req, res) => {
  const docs = await companyService.listMyRegistrationDocuments(req.user.id);
  sendResponse(res, 200, docs, 'Registration documents fetched');
});

const updateMyRegistrationDocument = catchAsync(async (req, res) => {
  const doc = await companyService.updateMyRegistrationDocument(
    req.user.id,
    req.params.registrationDocumentId,
    req.body
  );
  sendResponse(res, 200, doc, 'Registration document updated');
});

const deleteMyRegistrationDocument = catchAsync(async (req, res) => {
  const doc = await companyService.deleteMyRegistrationDocument(
    req.user.id,
    req.params.registrationDocumentId
  );
  sendResponse(res, 200, doc, 'Registration document deleted');
});

const updateMyDocument = catchAsync(async (req, res) => {
  const doc = await companyService.updateMyDocument(req.user.id, req.params.documentId, req.body);
  sendResponse(res, 200, doc, 'Company document updated');
});

const deleteMyDocument = catchAsync(async (req, res) => {
  const doc = await companyService.deleteMyDocument(req.user.id, req.params.documentId);
  sendResponse(res, 200, doc, 'Company document deleted');
});

const listMyContributions = catchAsync(async (req, res) => {
  const contributions = await companyService.listMyContributions(req.user.id);
  sendResponse(res, 200, contributions, 'Company contributions fetched');
});

const createMyContribution = catchAsync(async (req, res) => {
  const contribution = await companyService.createMyContribution(req.user.id, req.body);
  sendResponse(res, 201, contribution, 'Company contribution created');
});

const updateMyContribution = catchAsync(async (req, res) => {
  const contribution = await companyService.updateMyContribution(
    req.user.id,
    req.params.contributionId,
    req.body
  );
  sendResponse(res, 200, contribution, 'Company contribution updated');
});

const deleteMyContribution = catchAsync(async (req, res) => {
  const contribution = await companyService.deleteMyContribution(
    req.user.id,
    req.params.contributionId
  );
  sendResponse(res, 200, contribution, 'Company contribution deleted');
});

// Contribution Media Controllers
const listContributionMedia = catchAsync(async (req, res) => {
  const media = await companyService.listContributionMedia(req.user.id, req.params.contributionId);
  sendResponse(res, 200, media, 'Contribution media fetched');
});

const addContributionMedia = catchAsync(async (req, res) => {
  const media = await companyService.addContributionMedia(
    req.user.id,
    req.params.contributionId,
    req.body
  );
  sendResponse(res, 201, media, 'Contribution media added');
});

const updateContributionMedia = catchAsync(async (req, res) => {
  const media = await companyService.updateContributionMedia(
    req.user.id,
    req.params.contributionId,
    req.params.mediaId,
    req.body
  );
  sendResponse(res, 200, media, 'Contribution media updated');
});

const deleteContributionMedia = catchAsync(async (req, res) => {
  const media = await companyService.deleteContributionMedia(
    req.user.id,
    req.params.contributionId,
    req.params.mediaId
  );
  sendResponse(res, 200, media, 'Contribution media deleted');
});

const reorderContributionMedia = catchAsync(async (req, res) => {
  const media = await companyService.reorderContributionMedia(
    req.user.id,
    req.params.contributionId,
    req.body.orderedIds
  );
  sendResponse(res, 200, media, 'Contribution media reordered');
});

const listCompanyDocuments = catchAsync(async (req, res) => {
  const docs = await companyService.listCompanyDocuments(req.params.id);
  sendResponse(res, 200, docs, 'Company documents fetched');
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  getCompanyProfile,
  addGalleryItem,
  listGallery,
  listReviews,
  searchCompanies,
  createReview,
  resendForReview,
  listMyGallery,
  updateMyGalleryItem,
  deleteMyGalleryItem,
  listMyDocuments,
  listMyRegistrationDocuments,
  createMyDocument,
  updateMyRegistrationDocument,
  deleteMyRegistrationDocument,
  updateMyDocument,
  deleteMyDocument,
  listMyContributions,
  createMyContribution,
  updateMyContribution,
  deleteMyContribution,
  listContributionMedia,
  addContributionMedia,
  updateContributionMedia,
  deleteContributionMedia,
  reorderContributionMedia,
  listCompanyDocuments,
};
