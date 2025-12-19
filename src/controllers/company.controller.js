const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const companyService = require('../services/company.service');

const getMyProfile = catchAsync(async (req, res) => {
    const profile = await companyService.getMyProfile(req.user.id);
    sendResponse(res, 200, profile.company, 'Company profile fetched');
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

const createReview = catchAsync(async (req, res) => {
    const review = await companyService.createReview(req.user.id, req.params.id, req.body);
    sendResponse(res, 201, review, 'Review submitted');
});

module.exports = {
    getMyProfile,
    updateMyProfile,
    getCompanyProfile,
    addGalleryItem,
    listGallery,
    listReviews,
    createReview,
};
