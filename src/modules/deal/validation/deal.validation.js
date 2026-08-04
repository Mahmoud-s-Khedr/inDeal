const { z } = require('zod');

// Enums (matching v1 model)
const dealTypeEnumValues = ['supply', 'demand'];
const dealStatusEnumValues = ['open', 'closed', 'archived'];
const dealRequestStatusEnumValues = ['pending', 'paused', 'accepted', 'rejected', 'canceled'];
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

const queryBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return value;
}, z.boolean());

const incotermValues = ['EXW', 'CIF', 'FOB', 'DAP', 'DDP'];
const supplyCategoryValues = [
  'packing',
  'containers',
  'rawMaterial',
  'industrialEquipment',
  'foodAndBeverage',
  'chemicals',
  'textileAndApparel',
  'electronicsAndComponents',
  'constructionMaterials',
  'services',
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
    quantityRequired: z.coerce.number().positive(),
    deliveryLocation: z.string().min(1).max(255),
    deliveryDate: z.coerce.date(),
    targetPrice: z.coerce.number().positive(),
    currency: z.string().min(1).max(10),
    paymentTermsPreference: z.string().max(500).optional(),
    incoterm: z.enum(incotermValues).optional(),
    bulkDiscountExpectation: z.string().max(500).optional(),
    supplyType: z
      .enum(['inStock', 'assembleToOrder', 'makeToOrder', 'engineeringToOrder', 'mixed'])
      .optional(),
    keySpecifications: z.string().min(1).max(2000),
    material: z.string().max(200).optional(),
    dimensionsSize: z.string().max(200).optional(),
    certificationsRequired: z.string().min(1).max(1000).optional(),
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
    otherQualityLevelDescription: z.string().min(1).max(255).optional(),
    maxLeadTimeAccepted: z.string().min(1).max(100),
    deliveryMethodPreference: z.enum(['supplierDelivers', 'buyerCollects', 'thirdParty']),
    packagingRequirements: z.string().max(1000).optional(),
    specialConditionsNotes: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.qualityLevel === 'other' && !data.otherQualityLevelDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherQualityLevelDescription'],
        message: 'otherQualityLevelDescription is required when qualityLevel is other',
      });
    }

    if (data.qualityLevel !== 'other' && data.otherQualityLevelDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['otherQualityLevelDescription'],
        message: 'otherQualityLevelDescription is only allowed when qualityLevel is other',
      });
    }
  })
  .strict();

const demandDetailsSchema = z
  .object({
    productServiceName: z.string().min(1).max(200),
    availableQuantity: z.coerce.number().positive(),
    offerValidityDays: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().positive(),
    currency: z.string().min(1).max(10),
    totalPrice: z.coerce.number().positive().optional(),
    volumeDiscountTiers: z.array(z.string().min(1).max(100)).optional(),
    moq: z.coerce.number().positive(),
    availabilityType: z.enum([
      'inStock',
      'assembleToOrder',
      'makeToOrder',
      'engineeringToOrder',
      'mixed',
    ]),
    quantityInStock: z.coerce.number().nonnegative().optional(),
    maxProduceQuantity: z.coerce.number().nonnegative().optional(),
    productionLeadTime: z.string().max(100).optional(),
    specsMatchRfq: z.enum(['exact', 'partial']),
    differencesFromRfq: z.string().max(2000).optional(),
    materialOffered: z.string().min(1).max(200),
    dimensions: z.string().min(1).max(200),
    certificationsHeld: z.string().min(1).max(1000).optional(),
    paymentTerms: z.string().min(1).max(500),
    deliveryTerms: z.enum(incotermValues),
    warrantyPolicy: z.string().max(1000).optional(),
    returnPolicy: z.string().max(1000).optional(),
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
    type: z.enum(dealTypeEnumValues).optional(),
    sortBy: z.enum(['price', 'date', 'applications']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const createDealRequestSchema = z
  .object({
    params: z.object({
      id: z.coerce.number().int().positive(), // deal ID
    }),
    body: z
      .object({
        requestType: z.enum(['inSupply', 'inDemand']),
        supplyDetails: supplyDetailsSchema.optional(),
        demandDetails: demandDetailsSchema.optional(),
        attachments: z.array(requestAttachmentInputSchema).max(20).optional().default([]),
      })
      .strict(),
  })
  .superRefine((data, ctx) => {
    const { requestType, supplyDetails, demandDetails } = data.body;

    if (requestType === 'inSupply' && !supplyDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'supplyDetails'],
        message: 'supplyDetails is required for inSupply requests',
      });
    }

    if (requestType === 'inDemand' && !demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is required for inDemand requests',
      });
    }

    if (requestType === 'inDemand' && supplyDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'supplyDetails'],
        message: 'supplyDetails is not allowed for inDemand requests',
      });
    }

    if (requestType === 'inSupply' && demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is not allowed for inSupply requests',
      });
    }
  });

const createDirectRequestSchema = z
  .object({
    body: z
      .object({
        targetCompanyId: z.coerce.number().int().positive(),
        supplyDetails: supplyDetailsSchema,
        attachments: z.array(requestAttachmentInputSchema).max(20).optional().default([]),
      })
      .strict(),
  })
  .superRefine((data, ctx) => {
    const { demandDetails } = data.body;
    if (demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'demandDetails'],
        message: 'demandDetails is not allowed for direct requests',
      });
    }
  });

const updateDealRequestSchema = z
  .object({
    params: z.object({
      requestId: z.coerce.number().int().positive(),
    }),
    body: z
      .object({
        supplyDetails: supplyDetailsSchema.optional(),
        demandDetails: demandDetailsSchema.optional(),
        attachments: z.array(requestAttachmentInputSchema).max(20).default([]),
      })
      .strict(),
  })
  .superRefine((data, ctx) => {
    const { supplyDetails, demandDetails } = data.body;

    if (!supplyDetails && !demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: 'Either supplyDetails or demandDetails is required',
      });
    }

    if (supplyDetails && demandDetails) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: 'supplyDetails and demandDetails cannot be provided together',
      });
    }
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
    canceled: queryBooleanSchema.optional(),
    requestType: z.enum(['inSupply', 'inDemand']).optional(),
    sortBy: z.enum(['price', 'date']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const listMyRequestsSchema = z.object({
  query: z
    .object({
      keyword: z.string().max(200).optional(),
      status: z.enum(dealRequestStatusEnumValues).optional(),
      canceled: queryBooleanSchema.optional(),
      type: z.enum(['direct', 'supply']).optional(),
      sortBy: z.enum(['price', 'date']).optional(),
      sortOrder: z.enum(['asc', 'desc']).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .strict(),
});

const listMyApplicationsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    status: z.enum(dealRequestStatusEnumValues).optional(),
    canceled: queryBooleanSchema.optional(),
    sortBy: z.enum(['price', 'date']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const listMyDirectRequestsSchema = z.object({
  query: z.object({
    keyword: z.string().max(200).optional(),
    status: z.enum(dealRequestStatusEnumValues).optional(),
    canceled: queryBooleanSchema.optional(),
    sortBy: z.enum(['price', 'date']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
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

const sendDealEmailSchema = z.object({
  body: z.object({
    dealId: z.coerce.number().int().positive(),
    subject: z
      .string()
      .trim()
      .min(1, 'subject is required')
      .max(200, 'subject must be at most 200 characters'),
    message: z
      .string()
      .trim()
      .min(1, 'message is required')
      .max(5000, 'message must be at most 5000 characters'),
    contactInfo: z
      .string()
      .trim()
      .max(500, 'contactInfo must be at most 500 characters')
      .optional(),
  }),
});

module.exports = {
  dealTypeEnumValues,
  dealStatusEnumValues,
  dealRequestStatusEnumValues,
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
  listMyDirectRequestsSchema,
  withdrawRequestSchema,
  sendDealEmailSchema,
};
