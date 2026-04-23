const express = require('express');
const protect = require('../../../core/middleware/authMiddleware');
const requireRoles = require('../../../core/middleware/roleMiddleware');
const validate = require('../../../core/middleware/validateMiddleware');
const adminController = require('../controller/admin.controller');
const {
  companyIdParamsSchema,
  updateReviewRequestSchema,
} = require('../validation/admin.validation');

const router = express.Router();

router.get(
  '/company-review-requests',
  protect,
  requireRoles('admin'),
  adminController.listCompanyReviewRequests
);
router.get(
  '/company-review-requests/:companyId',
  protect,
  requireRoles('admin'),
  validate(companyIdParamsSchema),
  adminController.getCompanyReviewRequest
);
router.patch(
  '/company-review-requests/:companyId',
  protect,
  requireRoles('admin'),
  validate(updateReviewRequestSchema),
  adminController.updateCompanyReviewRequest
);

module.exports = router;
