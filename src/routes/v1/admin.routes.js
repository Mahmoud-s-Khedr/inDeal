const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const requireRoles = require('../../middlewares/roleMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const adminCompanyController = require('../../controllers/adminCompany.controller');
const {
	reviewCompanyStatusSchema,
	companyParamsSchema,
	changeCompanyAgentSchema,
	updateCompanySchema,
	updateCompanySummarySchema,
	createCompanyGalleryItemSchema,
	updateCompanyGalleryItemSchema,
	galleryItemParamsSchema,
	createCompanyDocumentSchema,
	updateCompanyDocumentSchema,
	documentParamsSchema,
	createCompanyContributionSchema,
	updateCompanyContributionSchema,
	contributionParamsSchema,
} = require('../../validations/admin.validation');

const router = express.Router();

router.use(protect, requireRoles('admin'));

router.get('/companies', adminCompanyController.listCompanies);
router.get('/companies/pending', adminCompanyController.listPendingCompanies);
router.get('/companies/:id', validate(companyParamsSchema), adminCompanyController.getCompanyDetail);
router.put('/companies/:id', validate(updateCompanySchema), adminCompanyController.updateCompany);
router.put('/companies/:id/summary', validate(updateCompanySummarySchema), adminCompanyController.updateCompanySummary);
router.patch('/companies/:id/status', validate(reviewCompanyStatusSchema), adminCompanyController.reviewCompanyStatus);
router.post('/companies/:id/approve', validate(companyParamsSchema), adminCompanyController.approveCompany);
router.post('/companies/:id/reject', validate(companyParamsSchema), adminCompanyController.rejectCompany);
router.post('/companies/:id/agent', validate(changeCompanyAgentSchema), adminCompanyController.changeCompanyAgent);

router.get('/companies/:id/reviews', validate(companyParamsSchema), adminCompanyController.listCompanyReviews);

router.get('/companies/:id/gallery', validate(companyParamsSchema), adminCompanyController.listCompanyGallery);
router.post('/companies/:id/gallery', validate(createCompanyGalleryItemSchema), adminCompanyController.createCompanyGalleryItem);
router.put(
	'/companies/:id/gallery/:galleryItemId',
	validate(updateCompanyGalleryItemSchema),
	adminCompanyController.updateCompanyGalleryItem
);
router.delete(
	'/companies/:id/gallery/:galleryItemId',
	validate(galleryItemParamsSchema),
	adminCompanyController.deleteCompanyGalleryItem
);

router.get('/companies/:id/documents', validate(companyParamsSchema), adminCompanyController.listCompanyDocuments);
router.post('/companies/:id/documents', validate(createCompanyDocumentSchema), adminCompanyController.createCompanyDocument);
router.put(
	'/companies/:id/documents/:documentId',
	validate(updateCompanyDocumentSchema),
	adminCompanyController.updateCompanyDocument
);
router.delete(
	'/companies/:id/documents/:documentId',
	validate(documentParamsSchema),
	adminCompanyController.deleteCompanyDocument
);

router.get('/companies/:id/contributions', validate(companyParamsSchema), adminCompanyController.listCompanyContributions);
router.post(
	'/companies/:id/contributions',
	validate(createCompanyContributionSchema),
	adminCompanyController.createCompanyContribution
);
router.put(
	'/companies/:id/contributions/:contributionId',
	validate(updateCompanyContributionSchema),
	adminCompanyController.updateCompanyContribution
);
router.delete(
	'/companies/:id/contributions/:contributionId',
	validate(contributionParamsSchema),
	adminCompanyController.deleteCompanyContribution
);

module.exports = router;
