const express = require('express');
const protect = require('../../../core/middleware/authMiddleware');
const validate = require('../../../core/middleware/validateMiddleware');
const companyController = require('../controller/company.controller');
const {
  updateCompanySchema,
  addGalleryItemSchema,
  galleryItemParamsSchema,
  updateGalleryItemSchema,
  documentIdParamsSchema,
  registrationDocumentIdParamsSchema,
  createDocumentSchema,
  updateDocumentSchema,
  updateRegistrationDocumentSchema,
  contributionIdParamsSchema,
  createContributionSchema,
  updateContributionSchema,
  createReviewSchema,
  companyIdParamsSchema,
  searchCompaniesSchema,
  listMyDocumentsSchema,
  listMyContributionsSchema,
  listCompanyDocumentsSchema,
  addContributionMediaSchema,
  contributionMediaIdParamsSchema,
  updateContributionMediaSchema,
  reorderContributionMediaSchema,
} = require('../validation/company.validation');

const router = express.Router();

// Company search (public)
router.get('/search', validate(searchCompaniesSchema), companyController.searchCompanies);

router.get('/me', protect, companyController.getMyProfile);
router.put('/me', protect, validate(updateCompanySchema), companyController.updateMyProfile);

router.get('/me/gallery', protect, companyController.listMyGallery);
router.post(
  '/me/gallery',
  protect,
  validate(addGalleryItemSchema),
  companyController.addGalleryItem
);
router.put(
  '/me/gallery/:galleryItemId',
  protect,
  validate(updateGalleryItemSchema),
  companyController.updateMyGalleryItem
);
router.delete(
  '/me/gallery/:galleryItemId',
  protect,
  validate(galleryItemParamsSchema),
  companyController.deleteMyGalleryItem
);

router.get(
  '/me/documents',
  protect,
  validate(listMyDocumentsSchema),
  companyController.listMyDocuments
);
router.post(
  '/me/documents',
  protect,
  validate(createDocumentSchema),
  companyController.createMyDocument
);
router.get('/me/registration-documents', protect, companyController.listMyRegistrationDocuments);
router.put(
  '/me/registration-documents/:registrationDocumentId',
  protect,
  validate(updateRegistrationDocumentSchema),
  companyController.updateMyRegistrationDocument
);
router.delete(
  '/me/registration-documents/:registrationDocumentId',
  protect,
  validate(registrationDocumentIdParamsSchema),
  companyController.deleteMyRegistrationDocument
);
router.put(
  '/me/documents/:documentId',
  protect,
  validate(updateDocumentSchema),
  companyController.updateMyDocument
);
router.delete(
  '/me/documents/:documentId',
  protect,
  validate(documentIdParamsSchema),
  companyController.deleteMyDocument
);

router.get(
  '/me/contributions',
  protect,
  validate(listMyContributionsSchema),
  companyController.listMyContributions
);
router.post(
  '/me/contributions',
  protect,
  validate(createContributionSchema),
  companyController.createMyContribution
);
router.put(
  '/me/contributions/:contributionId',
  protect,
  validate(updateContributionSchema),
  companyController.updateMyContribution
);
router.delete(
  '/me/contributions/:contributionId',
  protect,
  validate(contributionIdParamsSchema),
  companyController.deleteMyContribution
);

// Contribution Media endpoints (multiple media per contribution)
router.get(
  '/me/contributions/:contributionId/media',
  protect,
  validate(contributionIdParamsSchema),
  companyController.listContributionMedia
);
router.post(
  '/me/contributions/:contributionId/media',
  protect,
  validate(addContributionMediaSchema),
  companyController.addContributionMedia
);
router.put(
  '/me/contributions/:contributionId/media/reorder',
  protect,
  validate(reorderContributionMediaSchema),
  companyController.reorderContributionMedia
);
router.put(
  '/me/contributions/:contributionId/media/:mediaId',
  protect,
  validate(updateContributionMediaSchema),
  companyController.updateContributionMedia
);
router.delete(
  '/me/contributions/:contributionId/media/:mediaId',
  protect,
  validate(contributionMediaIdParamsSchema),
  companyController.deleteContributionMedia
);

// public company endpoints

router.get('/:id', validate(companyIdParamsSchema), companyController.getCompanyProfile);
router.get('/:id/gallery', validate(companyIdParamsSchema), companyController.listGallery);
router.get('/:id/reviews', validate(companyIdParamsSchema), companyController.listReviews);
router.post('/:id/reviews', protect, validate(createReviewSchema), companyController.createReview);
router.get(
  '/:id/documents',
  validate(listCompanyDocumentsSchema),
  companyController.listCompanyDocuments
);

module.exports = router;
