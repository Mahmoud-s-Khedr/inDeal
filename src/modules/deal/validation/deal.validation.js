const { z } = require('zod');

// Enums (matching v1 model)
const dealTypeEnumValues = ['supply', 'demand'];
const dealStatusEnumValues = ['open', 'closed', 'negotiating', 'archived'];
const dealRequestStatusEnumValues = ['pending', 'paused', 'accepted', 'rejected', 'canceled'];
const dealRequestKindEnumValues = ['supply', 'demand', 'rfq'];
const dealRequestTypeEnumValues = ['direct', 'inSupply'];
const requestAttachmentKindValues = ['image', 'file'];

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

const attachmentInputSchema = z.object({
  fileId: z.coerce.number().int().positive(),
  kind: z.enum(requestAttachmentKindValues),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const requestAttachmentInputSchema = z.object({
  fileId: z.coerce.number().int().positive(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const supplyDetailsSchema = z
  .object({
    productServiceName: z.string().min(1).max(200),
    category: z.enum(supplyCategoryValues),
    quantityRequired: z.coerce.number().positive().optional(),
    deliveryLocation: z.string().max(255).optional(),
    deliveryDate: z.coerce.date().optional(),
    targetPriceMin: z.coerce.number().positive().optional(),
    targetPriceMax: z.coerce.number().positive().optional(),
    currency: z.string().min(1).max(10).optional(),
    paymentTermsPreference: z.string().max(500).optional(),
    incoterm: z.enum(incotermValues).optional(),
    bulkDiscountExpectation: z.string().max(500).optional(),
    supplyType: z.enum(['inStock', 'assembleToOrder', 'makeToOrder', 'engineerToOrder']).optional(),
    keySpecifications: z.string().max(2000).optional(),
    material: z.string().max(200).optional(),
    dimensionsSize: z.string().max(200).optional(),
    certificationsRequired: z.array(z.string().min(1).max(150)).optional(),
    qualityLevel: z
      .enum([
        'standard',
        'industrialGuide',
        'foodGrade',
        'pharmaceuticalGrade',
        'exportQuality',
        'other',
      ])
      .optional(),
    qualityLevelOtherText: z.string().min(1).max(255).optional(),
    countryOfOrigin: z.string().max(100).optional(),
    maxLeadTimeAccepted: z.string().max(100).optional(),
    deliveryMethodPreference: z
      .enum(['supplierDelivers', 'buyerCollects', 'thirdParty'])
      .optional(),
    packagingRequirements: z.string().max(1000).optional(),
    specialConditionsNotes: z.string().max(2000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.qualityLevel === 'other' && !data.qualityLevelOtherText?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualityLevelOtherText'],
        message: 'qualityLevelOtherText is required when qualityLevel is other',
      });
    }

    if (data.qualityLevel !== 'other' && data.qualityLevelOtherText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['qualityLevelOtherText'],
        message: 'qualityLevelOtherText is only allowed when qualityLevel is other',
      });
    }
  });

const demandDetailsSchema = z
  .object({
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
  })
  .strict();

const createDealSchema = z.object({
  body: z.object({
    dealName: z.string().min(1).max(100),
    dealDescription: z.string().max(5000).optional(),
    dealValue: z.coerce.number().positive().optional(),
    dealType: z.enum(dealTypeEnumValues),
    attachments: z.array(attachmentInputSchema).max(20).optional().default([]),
  }),
});

const updateDealSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      dealName: z.string().min(1).max(100).optional(),
      dealDescription: z.string().max(5000).optional(),
      dealValue: z.coerce.number().positive().optional().nullable(),
      dealType: z.enum(dealTypeEnumValues).optional(),
      status: z.enum(dealStatusEnumValues).optional(),
      attachments: z.array(attachmentInputSchema).max(20).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

const searchDealsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    dealType: z.enum(dealTypeEnumValues).optional(),
    status: z.enum(dealStatusEnumValues).optional(),
    industry: z.enum(industryEnumValues).optional(),
    minValue: z.coerce.number().optional(),
    maxValue: z.coerce.number().optional(),
    createdFrom: z.coerce.date().optional(),
    createdTo: z.coerce.date().optional(),
    sortBy: z.enum(['price', 'date', 'applications']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const getDealSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const listMyDealsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    status: z.enum(dealStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const createDealRequestSchema = z
  .object({
    params: z.object({
      id: z.coerce.number().int().positive(), // deal ID
    }),
    body: z.object({
      requestKind: z.enum(dealRequestKindEnumValues),
      requestType: z.enum(dealRequestTypeEnumValues).optional().default('inSupply'),
      supplyDetails: supplyDetailsSchema.optional(),
      demandDetails: demandDetailsSchema.optional(),
      attachments: z.array(requestAttachmentInputSchema).max(20).optional().default([]),
    }),
  })
  .superRefine((data, ctx) => {
    const { requestKind, supplyDetails, demandDetails } = data.body;

    if ((requestKind === 'supply' || requestKind === 'rfq') && !supplyDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'supplyDetails'],
        message: 'supplyDetails is required for supply and rfq requests',
      });
    }

    if (requestKind === 'demand' && !demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is required for demand requests',
      });
    }

    if (requestKind === 'demand' && supplyDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'supplyDetails'],
        message: 'supplyDetails is not allowed for demand requests',
      });
    }

    if ((requestKind === 'supply' || requestKind === 'rfq') && demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is not allowed for supply/rfq requests',
      });
    }
  });

const createDirectRequestSchema = z
  .object({
    body: z.object({
      targetCompanyId: z.coerce.number().int().positive(),
      requestKind: z.enum(dealRequestKindEnumValues),
      requestType: z.literal('direct').optional().default('direct'),
      supplyDetails: supplyDetailsSchema.optional(),
      demandDetails: demandDetailsSchema.optional(),
      attachments: z.array(requestAttachmentInputSchema).max(20).optional().default([]),
    }),
  })
  .superRefine((data, ctx) => {
    const { requestKind, supplyDetails, demandDetails } = data.body;

    if ((requestKind === 'supply' || requestKind === 'rfq') && !supplyDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'supplyDetails'],
        message: 'supplyDetails is required for supply and rfq requests',
      });
    }

    if (requestKind === 'demand' && !demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is required for demand requests',
      });
    }

    if (requestKind === 'demand' && supplyDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'supplyDetails'],
        message: 'supplyDetails is not allowed for demand requests',
      });
    }

    if ((requestKind === 'supply' || requestKind === 'rfq') && demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is not allowed for supply/rfq requests',
      });
    }
  });

const updateDealRequestSchema = z.object({
  params: z.object({
    dealId: z.coerce.number().int().positive(),
    requestId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      requestKind: z.enum(dealRequestKindEnumValues).optional(),
      supplyDetails: supplyDetailsSchema.optional(),
      demandDetails: demandDetailsSchema.optional(),
      attachments: z.array(requestAttachmentInputSchema).max(20).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

const dealRequestStatusSchema = z.object({
  params: z.object({
    dealId: z.coerce.number().int().positive(),
    requestId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum(['accepted', 'rejected']),
  }),
});

const pauseDealRequestSchema = z.object({
  params: z.object({
    requestId: z.coerce.number().int().positive(),
  }),
});

const cancelDealRequestSchema = z.object({
  params: z.object({
    requestId: z.coerce.number().int().positive(),
  }),
  body: z.object({
    cancelReason: z.string().min(3).max(1000),
  }),
});

const listDealRequestsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(), // deal ID
  }),
  query: z.object({
    keyword: z.string().max(200).optional(),
    status: z.enum(dealRequestStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const listMyRequestsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    status: z.enum(dealRequestStatusEnumValues).optional(),
    requestType: z.enum(dealRequestTypeEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const listMyApplicationsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    status: z.enum(dealRequestStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const withdrawRequestSchema = z
  .object({
    params: z.object({
      requestId: z.coerce.number().int().positive(),
    }),
    query: z
      .object({
        cancelReason: z.string().min(3).max(1000).optional(),
      })
      .optional(),
    body: z
      .object({
        cancelReason: z.string().min(3).max(1000).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const reason = data.body?.cancelReason || data.query?.cancelReason;
    if (!reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'cancelReason'],
        message: 'cancelReason is required',
      });
    }
  });

module.exports = {
  dealTypeEnumValues,
  dealStatusEnumValues,
  dealRequestStatusEnumValues,
  dealRequestKindEnumValues,
  createDealSchema,
  updateDealSchema,
  searchDealsSchema,
  getDealSchema,
  listMyDealsSchema,
  createDealRequestSchema,
  createDirectRequestSchema,
  updateDealRequestSchema,
  dealRequestStatusSchema,
  pauseDealRequestSchema,
  cancelDealRequestSchema,
  listDealRequestsSchema,
  listMyRequestsSchema,
  listMyApplicationsSchema,
  withdrawRequestSchema,
};
