const { z } = require('zod');
const { defaultResponseSchema } = require('../schemas');

module.exports = {
  request: z.object({}),
  response: defaultResponseSchema,
};
