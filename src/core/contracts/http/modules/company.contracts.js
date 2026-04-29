const validation = require('../../../../modules/company/validation/company.validation');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: validation,
  response: defaultResponseSchema,
};
