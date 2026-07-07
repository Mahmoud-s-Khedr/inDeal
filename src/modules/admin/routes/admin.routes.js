const express = require('express');
const protect = require('../../../core/middleware/authMiddleware');
const requireRoles = require('../../../core/middleware/roleMiddleware');
const validate = require('../../../core/middleware/validateMiddleware');
const routeContract = require('../../../core/contracts/http/routeContract');
const { docsRequestSchemas } = require('../../../core/contracts/http/modules/admin.contracts');
const userAdminController = require('../controller/user.admin.controller');
const companyAdminController = require('../controller/company.admin.controller');
const dealAdminController = require('../controller/deal.admin.controller');
const analyticsAdminController = require('../controller/analytics.admin.controller');
const emailLogAdminController = require('../controller/emailLog.admin.controller');
const {
  listUsersSchema,
  userIdParamsSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  listCompaniesSchema,
  companyIdParamsSchema,
  updateCompanyStatusSchema,
  listDealsSchema,
  dealIdParamsSchema,
  updateDealStatusSchema,
  analyticsPeriodSchema,
  listEmailLogsSchema,
  emailLogIdParamsSchema,
} = require('../validation/admin.validation');

const router = express.Router();
const readAccess = requireRoles('admin', 'support');
const adminOnly = requireRoles('admin');
const adminContract = (requestSchema) => routeContract({ requestSchema, tag: 'Admin' });

router.use(protect);

router.get(
  '/users',
  readAccess,
  adminContract(docsRequestSchemas.listUsersSchema),
  validate(listUsersSchema),
  userAdminController.listUsers
);
router.get(
  '/users/:id',
  readAccess,
  adminContract(docsRequestSchemas.userIdParamsSchema),
  validate(userIdParamsSchema),
  userAdminController.getUserById
);
router.patch(
  '/users/:id/status',
  adminOnly,
  adminContract(docsRequestSchemas.updateUserStatusSchema),
  validate(updateUserStatusSchema),
  userAdminController.updateUserStatus
);
router.patch(
  '/users/:id/role',
  adminOnly,
  adminContract(docsRequestSchemas.updateUserRoleSchema),
  validate(updateUserRoleSchema),
  userAdminController.updateUserRole
);

router.get(
  '/companies',
  readAccess,
  adminContract(docsRequestSchemas.listCompaniesSchema),
  validate(listCompaniesSchema),
  companyAdminController.listCompanies
);
router.get(
  '/companies/:id',
  readAccess,
  adminContract(docsRequestSchemas.companyIdParamsSchema),
  validate(companyIdParamsSchema),
  companyAdminController.getCompanyById
);
router.patch(
  '/companies/:id/status',
  adminOnly,
  adminContract(docsRequestSchemas.updateCompanyStatusSchema),
  validate(updateCompanyStatusSchema),
  companyAdminController.updateCompanyStatus
);

router.get(
  '/deals',
  readAccess,
  adminContract(docsRequestSchemas.listDealsSchema),
  validate(listDealsSchema),
  dealAdminController.listDeals
);
router.get(
  '/deals/:id',
  readAccess,
  adminContract(docsRequestSchemas.dealIdParamsSchema),
  validate(dealIdParamsSchema),
  dealAdminController.getDealById
);
router.patch(
  '/deals/:id/status',
  adminOnly,
  adminContract(docsRequestSchemas.updateDealStatusSchema),
  validate(updateDealStatusSchema),
  dealAdminController.updateDealStatus
);

router.get(
  '/analytics/overview',
  readAccess,
  adminContract(),
  analyticsAdminController.getOverview
);
router.get(
  '/analytics/registrations',
  readAccess,
  adminContract(docsRequestSchemas.analyticsPeriodSchema),
  validate(analyticsPeriodSchema),
  analyticsAdminController.getRegistrations
);
router.get(
  '/analytics/deals',
  readAccess,
  adminContract(docsRequestSchemas.analyticsPeriodSchema),
  validate(analyticsPeriodSchema),
  analyticsAdminController.getDeals
);
router.get(
  '/analytics/requests',
  readAccess,
  adminContract(docsRequestSchemas.analyticsPeriodSchema),
  validate(analyticsPeriodSchema),
  analyticsAdminController.getRequests
);

router.get(
  '/email-logs',
  readAccess,
  adminContract(docsRequestSchemas.listEmailLogsSchema),
  validate(listEmailLogsSchema),
  emailLogAdminController.listEmailLogs
);
router.get(
  '/email-logs/:id',
  readAccess,
  adminContract(docsRequestSchemas.emailLogIdParamsSchema),
  validate(emailLogIdParamsSchema),
  emailLogAdminController.getEmailLogById
);

module.exports = router;
