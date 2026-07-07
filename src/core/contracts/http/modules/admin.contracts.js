const validation = require('../../../../modules/admin/validation/admin.validation');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: validation,
  response: defaultResponseSchema,
  docsRequestSchemas: {
    listUsersSchema: validation.listUsersSchema,
    userIdParamsSchema: validation.userIdParamsSchema,
    updateUserStatusSchema: validation.updateUserStatusSchema,
    updateUserRoleSchema: validation.updateUserRoleSchema,
    listCompaniesSchema: validation.listCompaniesSchema,
    companyIdParamsSchema: validation.companyIdParamsSchema,
    updateCompanyStatusSchema: validation.updateCompanyStatusSchema,
    listDealsSchema: validation.listDealsSchema,
    dealIdParamsSchema: validation.dealIdParamsSchema,
    updateDealStatusSchema: validation.updateDealStatusSchema,
    analyticsPeriodSchema: validation.analyticsPeriodSchema,
    listEmailLogsSchema: validation.listEmailLogsSchema,
    emailLogIdParamsSchema: validation.emailLogIdParamsSchema,
  },
};
