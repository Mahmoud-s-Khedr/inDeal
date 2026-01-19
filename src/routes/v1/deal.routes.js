const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const dealController = require('../../controllers/deal.controller');
const {
  createDealSchema,
  updateDealSchema,
  searchDealsSchema,
  getDealSchema,
  listMyDealsSchema,
  createDealRequestSchema,
  dealRequestStatusSchema,
  listDealRequestsSchema,
  listMyRequestsSchema,
  withdrawRequestSchema,
} = require('../../validations/deal.validation');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────

// Search/list deals (public, but auth adds context)
router.get('/', validate(searchDealsSchema), dealController.searchDeals);

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

// Submit request/bid on a deal
router.post(
  '/:id/requests',
  protect,
  validate(createDealRequestSchema),
  dealController.createDealRequest
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

// Withdraw my request
router.delete(
  '/requests/:requestId',
  protect,
  validate(withdrawRequestSchema),
  dealController.withdrawRequest
);

module.exports = router;
