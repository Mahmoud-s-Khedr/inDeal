const validation = require('../../../../modules/file/validation/file.validation');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: validation,
  response: defaultResponseSchema,
};
