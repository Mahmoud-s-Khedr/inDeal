const AppError = require('../utils/AppError');
const adRepository = require('../repositories/ad.repository');
const companyRepository = require('../repositories/company.repository');
const logger = require('../utils/logger');
const { publicUrl } = require('../config/storage');

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const buildPublicUrl = (filePath) => {
  if (!publicUrl || !filePath) return null;
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const sanitizeAd = (ad) => {
  if (!ad) return null;
  return {
    id: ad.id,
    companyId: ad.company_id,
    companyName: ad.company_name,
    title: ad.title,
    content: ad.content,
    imageFileId: ad.image_file_id,
    imageUrl: buildPublicUrl(ad.image_file_path),
    targetUrl: ad.target_url,
    location: ad.location,
    type: ad.type,
    status: ad.status,
    startDate: ad.start_date,
    endDate: ad.end_date,
    createdAt: ad.created_at,
    updatedAt: ad.updated_at,
  };
};

const sanitizePublicAd = (ad) => {
  if (!ad) return null;
  return {
    id: ad.id,
    companyId: ad.company_id,
    companyName: ad.company_name,
    title: ad.title,
    content: ad.content,
    imageUrl: buildPublicUrl(ad.image_file_path),
    targetUrl: ad.target_url,
    location: ad.location,
    type: ad.type,
  };
};

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

const createAd = async (companyId, data) => {
  // Verify company is active
  const company = await companyRepository.findById(companyId);
  if (!company || company.status !== 'active') {
    throw new AppError('Company must be active to create ads', 403);
  }

  const ad = await adRepository.create(null, {
    companyId,
    ...data,
  });

  logger.info('Advertisement created', { adId: ad.id, companyId });

  return sanitizeAd(await adRepository.findById(ad.id));
};

// ─────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────

const getAdById = async (adId, companyId = null) => {
  const ad = await adRepository.findById(adId);
  if (!ad) {
    throw new AppError('Advertisement not found', 404);
  }

  // If companyId provided, verify ownership
  if (companyId && ad.company_id !== companyId) {
    throw new AppError('Unauthorized to view this ad', 403);
  }

  return sanitizeAd(ad);
};

const getMyAds = async (companyId, filters = {}) => {
  const [ads, total] = await Promise.all([
    adRepository.findByCompanyId(companyId, filters),
    adRepository.countByCompanyId(companyId, filters.status),
  ]);

  return {
    ads: ads.map(sanitizeAd),
    pagination: {
      total,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      hasMore: (filters.offset || 0) + ads.length < total,
    },
  };
};

const getActiveAds = async (filters = {}) => {
  const ads = await adRepository.findActive(filters);

  // Record impressions for returned ads
  for (const ad of ads) {
    adRepository.recordImpression(ad.id).catch((err) => {
      logger.warn({ err, adId: ad.id }, 'Failed to record impression');
    });
  }

  return ads.map(sanitizePublicAd);
};

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

const updateAd = async (adId, companyId, data) => {
  const ad = await adRepository.findById(adId);
  if (!ad) {
    throw new AppError('Advertisement not found', 404);
  }
  if (ad.company_id !== companyId) {
    throw new AppError('Unauthorized to update this ad', 403);
  }

  // If ad was active and content changes, reset to pending for review
  const contentChanged = data.title || data.content || data.imageFileId || data.targetUrl;
  if (ad.status === 'active' && contentChanged) {
    data.status = 'pending';
  }

  await adRepository.update(adId, data);
  logger.info('Advertisement updated', { adId, companyId });

  return sanitizeAd(await adRepository.findById(adId));
};

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

const deleteAd = async (adId, companyId) => {
  const ad = await adRepository.findById(adId);
  if (!ad) {
    throw new AppError('Advertisement not found', 404);
  }
  if (ad.company_id !== companyId) {
    throw new AppError('Unauthorized to delete this ad', 403);
  }

  await adRepository.deleteById(adId);
  logger.info('Advertisement deleted', { adId, companyId });

  return { deleted: true };
};

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────

const recordClick = async (adId, userId = null, ipAddress = null, userAgent = null) => {
  const ad = await adRepository.findById(adId);
  if (!ad || ad.status !== 'active') {
    throw new AppError('Advertisement not found or not active', 404);
  }

  await adRepository.recordClick(adId, userId, ipAddress, userAgent);

  return { targetUrl: ad.target_url };
};

const getAdAnalytics = async (adId, companyId, filters = {}) => {
  const ad = await adRepository.findById(adId);
  if (!ad) {
    throw new AppError('Advertisement not found', 404);
  }
  if (ad.company_id !== companyId) {
    throw new AppError('Unauthorized to view analytics', 403);
  }

  const [daily, totals] = await Promise.all([
    adRepository.getAnalytics(adId, filters),
    adRepository.getTotalAnalytics(adId),
  ]);

  return {
    totals: {
      impressions: parseInt(totals.total_impressions, 10),
      clicks: parseInt(totals.total_clicks, 10),
      ctr:
        totals.total_impressions > 0
          ? ((totals.total_clicks / totals.total_impressions) * 100).toFixed(2)
          : '0.00',
    },
    daily: daily.map((d) => ({
      date: d.date,
      impressions: d.impressions_count,
      clicks: d.clicks_count,
    })),
  };
};

// ─────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────

const adminListAds = async (filters = {}) => {
  const [ads, total] = await Promise.all([
    adRepository.findAll(filters),
    adRepository.countAll(filters),
  ]);

  return {
    ads: ads.map(sanitizeAd),
    pagination: {
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      hasMore: (filters.offset || 0) + ads.length < total,
    },
  };
};

const adminGetAd = async (adId) => {
  const ad = await adRepository.findById(adId);
  if (!ad) {
    throw new AppError('Advertisement not found', 404);
  }

  const analytics = await adRepository.getTotalAnalytics(adId);

  return {
    ...sanitizeAd(ad),
    analytics: {
      impressions: parseInt(analytics.total_impressions, 10),
      clicks: parseInt(analytics.total_clicks, 10),
    },
  };
};

const adminUpdateAdStatus = async (adId, status) => {
  const ad = await adRepository.findById(adId);
  if (!ad) {
    throw new AppError('Advertisement not found', 404);
  }

  await adRepository.update(adId, { status });
  logger.info('Admin updated ad status', { adId, status });

  return sanitizeAd(await adRepository.findById(adId));
};

module.exports = {
  createAd,
  getAdById,
  getMyAds,
  getActiveAds,
  updateAd,
  deleteAd,
  recordClick,
  getAdAnalytics,
  adminListAds,
  adminGetAd,
  adminUpdateAdStatus,
};
