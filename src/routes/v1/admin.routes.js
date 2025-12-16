const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const requireRoles = require('../../middlewares/roleMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const adminCompanyController = require('../../controllers/adminCompany.controller');
const { reviewCompanyStatusSchema, companyParamsSchema, changeCompanyAgentSchema } = require('../../validations/admin.validation');

const router = express.Router();

router.use(protect, requireRoles('admin'));

router.get('/companies', adminCompanyController.listCompanies);
router.get('/companies/pending', adminCompanyController.listPendingCompanies);
router.get('/companies/:id', validate(companyParamsSchema), adminCompanyController.getCompanyDetail);
router.patch('/companies/:id/status', validate(reviewCompanyStatusSchema), adminCompanyController.reviewCompanyStatus);
router.post('/companies/:id/approve', validate(companyParamsSchema), adminCompanyController.approveCompany);
router.post('/companies/:id/reject', validate(companyParamsSchema), adminCompanyController.rejectCompany);
router.post('/companies/:id/agent', validate(changeCompanyAgentSchema), adminCompanyController.changeCompanyAgent);

module.exports = router;
