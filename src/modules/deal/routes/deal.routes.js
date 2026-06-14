const express = require('express');
const protect = require('../../../core/middleware/authMiddleware');
const optionalAuth = require('../../../core/middleware/optionalAuthMiddleware');
const validate = require('../../../core/middleware/validateMiddleware');
const routeContract = require('../../../core/contracts/http/routeContract');
const { docsRequestSchemas } = require('../../../core/contracts/http/modules/deal.contracts');
const dealController = require('../controller/deal.controller');
const {
  createDealSchema,
  updateDealSchema,
  searchDealsSchema,
  getDealSchema,
  listMyDealsSchema,
  createDealRequestSchema,
  createDirectRequestSchema,
  dealRequestStatusSchema,
  pauseDealRequestSchema,
  cancelDealRequestSchema,
  listDealRequestsSchema,
  listMyRequestsSchema,
  listMyApplicationsSchema,
  listMyDirectRequestsSchema,
  updateDealRequestSchema,
  withdrawRequestSchema,
  sendDealEmailSchema,
} = require('../validation/deal.validation');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────

// Search/list deals (public, but auth adds context)
router.get(
  '/',
  optionalAuth,
  routeContract({ requestSchema: docsRequestSchemas.searchDealsSchema }),
  validate(searchDealsSchema),
  dealController.searchDeals
);

// Get single deal (public)
router.get('/:id', validate(getDealSchema), dealController.getDeal);

// ─────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES - MY DEALS (as owner)
// ─────────────────────────────────────────────────────────────

// List my published deals
router.get('/me/deals', protect, validate(listMyDealsSchema), dealController.getMyDeals);

// Create a new deal
router.post('/', protect, validate(createDealSchema), dealController.createDeal);

// Update my deal
router.put('/:id', protect, validate(updateDealSchema), dealController.updateDeal);

// Archive/delete my deal
router.delete('/:id', protect, validate(getDealSchema), dealController.archiveDeal);

// ─────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES - DEAL REQUESTS
// ─────────────────────────────────────────────────────────────

// List my submitted requests (as applicant)
router.get('/me/requests', protect, validate(listMyRequestsSchema), dealController.getMyRequests);

// List my submitted offers/applications (as applicant)
router.get(
  '/me/applications',
  protect,
  validate(listMyApplicationsSchema),
  dealController.getMyApplications
);

router.get(
  '/me/direct-requests',
  protect,
  validate(listMyDirectRequestsSchema),
  dealController.getMyDirectRequests
);

// Submit request/bid on a deal
router.post('/send-email', protect, validate(sendDealEmailSchema), dealController.sendDealEmail);

router.post(
  '/direct-requests',
  protect,
  routeContract({ requestSchema: docsRequestSchemas.createDirectRequestSchema }),
  validate(createDirectRequestSchema),
  dealController.createDirectRequest
);

router.post(
  '/:id/requests',
  protect,
  routeContract({ requestSchema: docsRequestSchemas.createDealRequestSchema }),
  validate(createDealRequestSchema),
  dealController.createDealRequest
);

router.put(
  '/requests/:requestId',
  protect,
  routeContract({ requestSchema: docsRequestSchemas.updateDealRequestSchema }),
  validate(updateDealRequestSchema),
  dealController.updateRequest
);

// Get requests for my deal (as owner)
router.get(
  '/:id/requests',
  protect,
  validate(listDealRequestsSchema),
  dealController.getDealRequests
);

// Accept/reject a request (as owner)
router.patch(
  '/:dealId/requests/:requestId/status',
  protect,
  validate(dealRequestStatusSchema),
  dealController.updateRequestStatus
);

// Pause my request (as applicant company admin)
router.patch(
  '/requests/:requestId/pause',
  protect,
  validate(pauseDealRequestSchema),
  dealController.pauseRequest
);

// Cancel my request with reason (as applicant company admin)
router.patch(
  '/requests/:requestId/cancel',
  protect,
  validate(cancelDealRequestSchema),
  dealController.cancelRequest
);

// Withdraw my request (legacy alias to cancel; requires cancelReason)
router.delete(
  '/requests/:requestId',
  protect,
  validate(withdrawRequestSchema),
  dealController.withdrawRequest
);

module.exports = router;
