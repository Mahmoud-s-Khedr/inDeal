const validation = require('../../../../modules/deal/validation/deal.validation');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: validation,
  response: defaultResponseSchema,
};
