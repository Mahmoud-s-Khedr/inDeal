const { z } = require('zod');

const successEnvelopeSchema = (dataSchema = z.unknown()) =>
  z.object({
    status: z.literal('success'),
    message: z.string(),
    data: dataSchema,
    token: z.string().optional(),
  });

const errorEnvelopeSchema = z.object({
  status: z.string(),
  message: z.string(),
});

const defaultRequestSchema = z.object({
  params: z.object({}).passthrough().optional(),
  query: z.object({}).passthrough().optional(),
  body: z.unknown().optional(),
});

const defaultResponseSchema = successEnvelopeSchema(z.unknown());

module.exports = {
  successEnvelopeSchema,
  errorEnvelopeSchema,
  defaultRequestSchema,
  defaultResponseSchema,
};
