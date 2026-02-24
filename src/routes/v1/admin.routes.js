const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const requireRoles = require('../../middlewares/roleMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const adminCompanyController = require('../../controllers/adminCompany.controller');
const adminDashboardController = require('../../controllers/adminDashboard.controller');
const adminUserController = require('../../controllers/adminUser.controller');
const dealController = require('../../controllers/deal.controller');
const {
  reviewCompanyStatusSchema,
  rejectCompanySchema,
  companyParamsSchema,
  changeCompanyAgentSchema,
  changeAgentEmailSchema,
  updateCompanySchema,
  updateCompanySummarySchema,
  createCompanyGalleryItemSchema,
  updateCompanyGalleryItemSchema,
  galleryItemParamsSchema,
  createCompanyDocumentSchema,
  updateCompanyDocumentSchema,
  documentParamsSchema,
  registrationDocumentParamsSchema,
  updateCompanyRegistrationDocumentSchema,
  createCompanyContributionSchema,
  updateCompanyContributionSchema,
  contributionParamsSchema,
} = require('../../validations/admin.validation');
const {
  adminListDealsSchema,
  adminUpdateDealStatusSchema,
  getDealSchema,
} = require('../../validations/deal.validation');

const router = express.Router();

router.use(protect, requireRoles('admin'));

router.get('/dashboard/cards', adminDashboardController.getDashboardCards);
router.get('/companies', adminCompanyController.listCompanies);
router.get('/companies/pending', adminCompanyController.listPendingCompanies);
// ═══════════════════════════════════════════════════════════════
// Admin Pending Updates Management (FR-ADMIN-003)
// ═══════════════════════════════════════════════════════════════
const pendingUpdateController = require('../../controllers/pendingUpdate.controller');

router.get('/companies/pending-updates', pendingUpdateController.listPendingUpdates);
router.get('/companies/pending-updates/:id', pendingUpdateController.getPendingUpdate);
router.post('/companies/pending-updates/:id/approve', pendingUpdateController.approveUpdate);
router.post('/companies/pending-updates/:id/reject', pendingUpdateController.rejectUpdate);
router.get(
  '/companies/:id',
  validate(companyParamsSchema),
  adminCompanyController.getCompanyDetail
);
router.put('/companies/:id', validate(updateCompanySchema), adminCompanyController.updateCompany);
router.put(
  '/companies/:id/summary',
  validate(updateCompanySummarySchema),
  adminCompanyController.updateCompanySummary
);
router.patch(
  '/companies/:id/status',
  validate(reviewCompanyStatusSchema),
  adminCompanyController.reviewCompanyStatus
);
router.post(
  '/companies/:id/approve',
  validate(companyParamsSchema),
  adminCompanyController.approveCompany
);
router.post(
  '/companies/:id/reject',
  validate(rejectCompanySchema),
  adminCompanyController.rejectCompany
);
router.post(
  '/companies/:id/agent',
  validate(changeCompanyAgentSchema),
  adminCompanyController.changeCompanyAgent
);

// Dev-only: change agent email
router.patch(
  '/agents/:id/email',
  validate(changeAgentEmailSchema),
  adminUserController.changeAgentEmail
);

router.get(
  '/companies/:id/reviews',
  validate(companyParamsSchema),
  adminCompanyController.listCompanyReviews
);

router.get(
  '/companies/:id/gallery',
  validate(companyParamsSchema),
  adminCompanyController.listCompanyGallery
);
router.post(
  '/companies/:id/gallery',
  validate(createCompanyGalleryItemSchema),
  adminCompanyController.createCompanyGalleryItem
);
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

router.get(
  '/companies/:id/documents',
  validate(companyParamsSchema),
  adminCompanyController.listCompanyDocuments
);
router.post(
  '/companies/:id/documents',
  validate(createCompanyDocumentSchema),
  adminCompanyController.createCompanyDocument
);
router.put(
  '/companies/:id/documents/:documentId',
  validate(updateCompanyDocumentSchema),
  adminCompanyController.updateCompanyDocument
);
router.get(
  '/companies/:id/registration-documents',
  validate(companyParamsSchema),
  adminCompanyController.listCompanyRegistrationDocuments
);
router.put(
  '/companies/:id/registration-documents/:registrationDocumentId',
  validate(updateCompanyRegistrationDocumentSchema),
  adminCompanyController.updateCompanyRegistrationDocument
);
router.delete(
  '/companies/:id/registration-documents/:registrationDocumentId',
  validate(registrationDocumentParamsSchema),
  adminCompanyController.deleteCompanyRegistrationDocument
);
router.delete(
  '/companies/:id/documents/:documentId',
  validate(documentParamsSchema),
  adminCompanyController.deleteCompanyDocument
);

router.get(
  '/companies/:id/contributions',
  validate(companyParamsSchema),
  adminCompanyController.listCompanyContributions
);
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

// Admin Deal Management
router.get('/deals', validate(adminListDealsSchema), dealController.adminListDeals);
router.get('/deals/:id', validate(getDealSchema), dealController.adminGetDeal);
router.patch(
  '/deals/:id/status',
  validate(adminUpdateDealStatusSchema),
  dealController.adminUpdateDealStatus
);

// Admin Ad Management
const adController = require('../../controllers/ad.controller');
const {
  adminListAdsSchema,
  adminUpdateAdStatusSchema,
  getAdSchema,
} = require('../../validations/ad.validation');

router.get('/ads', validate(adminListAdsSchema), adController.adminListAds);
router.get('/ads/:id', validate(getAdSchema), adController.adminGetAd);
router.patch(
  '/ads/:id/status',
  validate(adminUpdateAdStatusSchema),
  adController.adminUpdateAdStatus
);

// Admin Support Ticket Management
const supportController = require('../../controllers/support.controller');
const {
  adminListTicketsSchema,
  adminUpdateTicketSchema,
  addResponseSchema,
  getTicketSchema,
} = require('../../validations/support.validation');

router.get('/tickets', validate(adminListTicketsSchema), supportController.adminListTickets);
router.get('/tickets/:id', validate(getTicketSchema), supportController.adminGetTicket);
router.patch(
  '/tickets/:id',
  validate(adminUpdateTicketSchema),
  supportController.adminUpdateTicket
);
router.post(
  '/tickets/:id/responses',
  validate(addResponseSchema),
  supportController.adminAddResponse
);

// ═══════════════════════════════════════════════════════════════
// Admin Support Live Chat Management (FR-SUP-004)
// ═══════════════════════════════════════════════════════════════
const supportChatController = require('../../controllers/supportChat.controller');

router.get('/support/chats', supportChatController.adminListChats);
router.get('/support/chats/waiting', supportChatController.adminGetWaitingQueue);
router.get('/support/chats/:id', supportChatController.adminGetChat);
router.post('/support/chats/:id/assign', supportChatController.adminAssignChat);
router.post('/support/chats/:id/close', supportChatController.adminCloseChat);

module.exports = router;
