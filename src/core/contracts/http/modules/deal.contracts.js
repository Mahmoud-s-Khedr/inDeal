const { z } = require('zod');
const validation = require('../../../../modules/deal/validation/deal.validation');
const { defaultResponseSchema } = require('../schemas');
const { docsDateTime } = require('../docsSchemaHelpers');

const dealTypeEnumValues = ['supply', 'demand'];
const dealStatusEnumValues = ['open', 'closed', 'archived'];
const dealRequestKindEnumValues = ['supply', 'demand', 'rfq'];
const incotermValues = ['EXW', 'CIF', 'FOB', 'DAP', 'DDP'];
const supplyCategoryValues = [
  'packingAndContainers',
  'rawMaterial',
  'industrialEquipment',
  'foodAndBeverage',
  'chemicals',
  'textileAndApparel',
  'electronicsAndComponents',
  'constructionMaterialsAndServices',
];

const requestAttachmentInputSchema = z.object({
  fileId: z.coerce.number().int().positive(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const supplyDetailsSchema = z.object({
  productServiceName: z.string().min(1).max(200),
  category: z.enum(supplyCategoryValues),
  quantityRequired: z.coerce.number().positive().optional(),
  deliveryLocation: z.string().max(255).optional(),
  deliveryDate: docsDateTime().optional(),
  targetPriceMin: z.coerce.number().positive().optional(),
  targetPriceMax: z.coerce.number().positive().optional(),
  currency: z.string().min(1).max(10).optional(),
  paymentTermsPreference: z.string().max(500).optional(),
  incoterm: z.enum(incotermValues).optional(),
  bulkDiscountExpectation: z.string().max(500).optional(),
  supplyType: z.enum(['inStock', 'makeToOrder', 'either']).optional(),
  keySpecifications: z.string().max(2000).optional(),
  material: z.string().max(200).optional(),
  dimensionsSize: z.string().max(200).optional(),
  certificationsRequired: z.array(z.string().min(1).max(150)).optional(),
  qualityLevel: z
    .enum(['standard', 'industrialGuide', 'foodGrade', 'pharmaceuticalGrade', 'exportQuality'])
    .optional(),
  colorFinish: z.string().max(200).optional(),
  countryOfOrigin: z.string().max(100).optional(),
  maxLeadTimeAccepted: z.string().max(100).optional(),
  deliveryMethodPreference: z.enum(['supplierDelivers', 'buyerCollects', 'thirdParty']).optional(),
  packagingRequirements: z.string().max(1000).optional(),
  specialConditionsNotes: z.string().max(2000).optional(),
});

const demandDetailsSchema = z.object({
  productServiceName: z.string().min(1).max(200),
  availableQuantity: z.coerce.number().positive().optional(),
  offerValidityDays: z.coerce.number().int().positive().optional(),
  unitPrice: z.coerce.number().positive().optional(),
  currency: z.string().min(1).max(10).optional(),
  totalPrice: z.coerce.number().positive().optional(),
  volumeDiscountTiers: z.array(z.string().min(1).max(100)).optional(),
  moq: z.coerce.number().positive().optional(),
  availabilityType: z.enum(['inStock', 'makeToOrder', 'mixed']).optional(),
  quantityInStock: z.coerce.number().nonnegative().optional(),
  maxProduceQuantity: z.coerce.number().nonnegative().optional(),
  stockDeliveryTime: z.string().max(100).optional(),
  productionLeadTime: z.string().max(100).optional(),
  specsMatchRfq: z.enum(['yes', 'no', 'partial']).optional(),
  differencesFromRfq: z.string().max(2000).optional(),
  materialOffered: z.string().max(200).optional(),
  dimensions: z.string().max(200).optional(),
  certificationsHeld: z.array(z.string().min(1).max(150)).optional(),
  paymentTerms: z.string().max(500).optional(),
  deliveryTerms: z.enum(incotermValues).optional(),
  warrantyReturnPolicy: z.string().max(1000).optional(),
  exclusivityConfidentiality: z.string().max(1000).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

const searchDealsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    dealType: z.enum(dealTypeEnumValues).optional(),
    status: z.enum(dealStatusEnumValues).optional(),
    industry: z
      .enum([
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
      ])
      .optional(),
    minValue: z.coerce.number().optional(),
    maxValue: z.coerce.number().optional(),
    createdFrom: docsDateTime().optional(),
    createdTo: docsDateTime().optional(),
    sortBy: z.enum(['price', 'date', 'applications']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const createDealRequestSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    requestKind: z.enum(dealRequestKindEnumValues),
    requestType: z.literal('inSupply').optional().default('inSupply'),
    supplyDetails: supplyDetailsSchema.optional(),
    demandDetails: demandDetailsSchema.optional(),
    attachments: z.array(requestAttachmentInputSchema).max(20).optional().default([]),
  }),
});

const createDirectRequestSchema = z.object({
  body: z.object({
    targetCompanyId: z.coerce.number().int().positive(),
    requestKind: z.enum(dealRequestKindEnumValues),
    requestType: z.literal('direct').optional().default('direct'),
    supplyDetails: supplyDetailsSchema.optional(),
    demandDetails: demandDetailsSchema.optional(),
    attachments: z.array(requestAttachmentInputSchema).max(20).optional().default([]),
  }),
});

const updateDealRequestSchema = z.object({
  params: z.object({
    dealId: z.coerce.number().int().positive(),
    requestId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    requestKind: z.enum(dealRequestKindEnumValues).optional(),
    supplyDetails: supplyDetailsSchema.optional(),
    demandDetails: demandDetailsSchema.optional(),
    attachments: z.array(requestAttachmentInputSchema).max(20).optional(),
  }),
});

module.exports = {
  request: validation,
  response: defaultResponseSchema,
  docsRequestSchemas: {
    searchDealsSchema,
    createDealRequestSchema,
    createDirectRequestSchema,
    updateDealRequestSchema,
  },
};
