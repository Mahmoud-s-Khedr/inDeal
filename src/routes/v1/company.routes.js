const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const companyController = require('../../controllers/company.controller');
const {
    updateCompanySchema,
    addGalleryItemSchema,
    galleryItemParamsSchema,
    updateGalleryItemSchema,
    documentIdParamsSchema,
    createDocumentSchema,
    updateDocumentSchema,
    contributionIdParamsSchema,
    createContributionSchema,
    updateContributionSchema,
    createReviewSchema,
    companyIdParamsSchema,
} = require('../../validations/company.validation');

const router = express.Router();

router.get('/me', protect, companyController.getMyProfile);
router.put('/me', protect, validate(updateCompanySchema), companyController.updateMyProfile);

router.post('/me/resend-for-review', protect, companyController.resendForReview);

router.get('/me/gallery', protect, companyController.listMyGallery);
router.post('/me/gallery', protect, validate(addGalleryItemSchema), companyController.addGalleryItem);
router.put(
    '/me/gallery/:galleryItemId',
    protect,
    validate(updateGalleryItemSchema),
    companyController.updateMyGalleryItem
);
router.delete('/me/gallery/:galleryItemId', protect, validate(galleryItemParamsSchema), companyController.deleteMyGalleryItem);

router.get('/me/documents', protect, companyController.listMyDocuments);
router.post('/me/documents', protect, validate(createDocumentSchema), companyController.createMyDocument);
router.put('/me/documents/:documentId', protect, validate(updateDocumentSchema), companyController.updateMyDocument);
router.delete('/me/documents/:documentId', protect, validate(documentIdParamsSchema), companyController.deleteMyDocument);

router.get('/me/contributions', protect, companyController.listMyContributions);
router.post('/me/contributions', protect, validate(createContributionSchema), companyController.createMyContribution);
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

router.get('/:id', validate(companyIdParamsSchema), companyController.getCompanyProfile);
router.get('/:id/gallery', validate(companyIdParamsSchema), companyController.listGallery);
router.get('/:id/reviews', validate(companyIdParamsSchema), companyController.listReviews);
router.post('/:id/reviews', protect, validate(createReviewSchema), companyController.createReview);

module.exports = router;
