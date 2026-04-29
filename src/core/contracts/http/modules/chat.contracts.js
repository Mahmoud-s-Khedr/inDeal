const validation = require('../../../../modules/chat/validation/chat.validation');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: validation,
  response: defaultResponseSchema,
};
