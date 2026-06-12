const { z } = require('zod');
const validation = require('../../../../modules/auth/validation/auth.validation');
const { defaultResponseSchema } = require('../schemas');
const { docsDateTime } = require('../docsSchemaHelpers');

const contactSchema = z.object({
  type: z.string().min(1),
  value: z.string().min(1),
});

const documentSchema = z.object({
  fileId: z.coerce.number().int().positive(),
  docType: z.string().max(100).optional(),
  description: z.string().max(255).optional(),
  expiryDate: docsDateTime().optional(),
});

const companyTypeEnumValues = [
  'supplier',
  'manufacturer',
  'distributor',
  'retailer',
  'serviceProvider',
  'wholesaler',
  'eCommerce',
  'franchise',
  'cooperative',
  'holdingCompany',
  'consultancy',
  'logistics',
  'other',
];

const industryEnumValues = [
  'agriculture',
  'automotive',
  'banking',
  'construction',
  'education',
  'healthcare',
  'hospitality',
  'manufacturing',
  'retail',
  'technology',
  'telecommunications',
  'transportation',
  'other',
];

const manufacturingStrategyEnumValues = [
  'makeToStock',
  'makeToOrder',
  'assembleToOrder',
  'engineerToOrder',
];

const registerSchema = z.object({
  body: z.object({
    user: z.object({
      username: z.string().min(3).max(50),
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
      jobTitle: z.string().max(100).optional(),
    }),
    company: z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().max(20).optional(),
      website: z.string().url().max(100).optional(),
      companyType: z.enum(companyTypeEnumValues).optional(),
      companyIndustry: z.enum(industryEnumValues).optional(),
      manufacturingStrategy: z.enum(manufacturingStrategyEnumValues).optional(),
      contacts: z.array(contactSchema).optional(),
      locations: z.array(z.string().min(1)).optional(),
      documents: z.array(documentSchema).min(1).optional(),
    }),
  }),
});

const resubmitSchema = z.object({
  body: z.object({
    company: z
      .object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().max(20).optional(),
        website: z.string().url().max(100).optional(),
        companyType: z.enum(companyTypeEnumValues).optional(),
        companyIndustry: z.enum(industryEnumValues).optional(),
        manufacturingStrategy: z.enum(manufacturingStrategyEnumValues).optional(),
        contacts: z.array(contactSchema).optional(),
        locations: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    documents: z.array(documentSchema).min(1),
  }),
});

module.exports = {
  request: validation,
  response: defaultResponseSchema,
  docsRequestSchemas: {
    registerSchema,
    resubmitSchema,
  },
};
