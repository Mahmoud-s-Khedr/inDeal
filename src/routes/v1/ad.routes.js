const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const adController = require('../../controllers/ad.controller');
const {
  createAdSchema,
  updateAdSchema,
  getAdSchema,
  listMyAdsSchema,
  listActiveAdsSchema,
  recordClickSchema,
  getAnalyticsSchema,
} = require('../../validations/ad.validation');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────

// Get active ads for display (with impression tracking)
router.get('/active', validate(listActiveAdsSchema), adController.getActiveAds);

// Record click on ad (redirects to target URL)
router.get('/:id/click', validate(recordClickSchema), adController.recordClick);

// ─────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES
// ─────────────────────────────────────────────────────────────

router.use(protect);

// My ads management
router.get('/me', validate(listMyAdsSchema), adController.getMyAds);
router.post('/', validate(createAdSchema), adController.createAd);
router.get('/:id', validate(getAdSchema), adController.getMyAd);
router.put('/:id', validate(updateAdSchema), adController.updateAd);
router.delete('/:id', validate(getAdSchema), adController.deleteAd);

// Analytics for my ad
router.get('/:id/analytics', validate(getAnalyticsSchema), adController.getAdAnalytics);

module.exports = router;
