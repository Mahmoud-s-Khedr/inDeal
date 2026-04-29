const validation = require('../../../../modules/user/validation/user.validation');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: validation,
  response: defaultResponseSchema,
};
