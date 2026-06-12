const { z } = require('zod');
const validation = require('../../../../modules/company/validation/company.validation');
const { defaultResponseSchema } = require('../schemas');
const { docsDateTime } = require('../docsSchemaHelpers');

const createDocumentSchema = z.object({
  body: z.object({
    fileId: z.coerce.number().int().positive().optional(),
    docType: z.string().max(100).optional(),
    title: z.string().min(1).max(150).optional(),
    issuer: z.string().min(1).max(150).optional(),
    url: z.string().url().max(255).optional(),
    description: z.string().optional(),
    issueDate: docsDateTime().optional(),
    expiryDate: docsDateTime().optional(),
  }),
});

const updateDocumentSchema = z.object({
  params: z.object({
    documentId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    fileId: z.coerce.number().int().positive().optional(),
    docType: z.string().max(100).optional(),
    title: z.string().min(1).max(150).optional(),
    issuer: z.string().min(1).max(150).optional(),
    url: z.string().url().max(255).optional(),
    description: z.string().optional(),
    issueDate: docsDateTime().optional(),
    expiryDate: docsDateTime().optional(),
  }),
});

module.exports = {
  request: validation,
  response: defaultResponseSchema,
  docsRequestSchemas: {
    createDocumentSchema,
    updateDocumentSchema,
  },
};
