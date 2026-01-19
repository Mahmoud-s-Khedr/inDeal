const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const adService = require('../services/ad.service');

// ─────────────────────────────────────────────────────────────
// AGENT AD MANAGEMENT
// ─────────────────────────────────────────────────────────────

const createAd = catchAsync(async (req, res) => {
  const ad = await adService.createAd(req.user.company.id, req.body);
  sendResponse(res, 201, ad, 'Advertisement created');
});

const getMyAds = catchAsync(async (req, res) => {
  const result = await adService.getMyAds(req.user.company.id, req.query);
  sendResponse(res, 200, result, 'Advertisements fetched');
});

const getMyAd = catchAsync(async (req, res) => {
  const ad = await adService.getAdById(req.params.id, req.user.company.id);
  sendResponse(res, 200, ad, 'Advertisement details fetched');
});

const updateAd = catchAsync(async (req, res) => {
  const ad = await adService.updateAd(req.params.id, req.user.company.id, req.body);
  sendResponse(res, 200, ad, 'Advertisement updated');
});

const deleteAd = catchAsync(async (req, res) => {
  await adService.deleteAd(req.params.id, req.user.company.id);
  sendResponse(res, 200, null, 'Advertisement deleted');
});

const getAdAnalytics = catchAsync(async (req, res) => {
  const analytics = await adService.getAdAnalytics(req.params.id, req.user.company.id, req.query);
  sendResponse(res, 200, analytics, 'Analytics fetched');
});

// ─────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────

const getActiveAds = catchAsync(async (req, res) => {
  const ads = await adService.getActiveAds(req.query);
  sendResponse(res, 200, ads, 'Active ads fetched');
});

const recordClick = catchAsync(async (req, res) => {
  const userId = req.user?.id || null;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
  const userAgent = req.headers['user-agent'] || null;

  const result = await adService.recordClick(req.params.id, userId, ipAddress, userAgent);

  // Redirect to target URL if exists
  if (result.targetUrl) {
    return res.redirect(result.targetUrl);
  }

  sendResponse(res, 200, result, 'Click recorded');
});

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

const adminListAds = catchAsync(async (req, res) => {
  const result = await adService.adminListAds(req.query);
  sendResponse(res, 200, result, 'All ads fetched');
});

const adminGetAd = catchAsync(async (req, res) => {
  const ad = await adService.adminGetAd(req.params.id);
  sendResponse(res, 200, ad, 'Ad details fetched');
});

const adminUpdateAdStatus = catchAsync(async (req, res) => {
  const ad = await adService.adminUpdateAdStatus(req.params.id, req.body.status);
  sendResponse(res, 200, ad, 'Ad status updated');
});

module.exports = {
  createAd,
  getMyAds,
  getMyAd,
  updateAd,
  deleteAd,
  getAdAnalytics,
  getActiveAds,
  recordClick,
  adminListAds,
  adminGetAd,
  adminUpdateAdStatus,
};
