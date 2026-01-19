const { z } = require('zod');

// ─────────────────────────────────────────────────────────────
// Enum values (matching PostgreSQL enums in schema.sql)
// ─────────────────────────────────────────────────────────────

const dealTypeEnumValues = ['auction', 'rfq'];
const dealStatusEnumValues = ['open', 'closed', 'negotiating', 'archived'];
const dealRequestStatusEnumValues = ['pending', 'accepted', 'rejected', 'withdrawn'];

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

// ─────────────────────────────────────────────────────────────
// Deal Schemas
// ─────────────────────────────────────────────────────────────

const createDealSchema = z.object({
  body: z.object({
    dealName: z.string().min(1).max(100),
    dealDescription: z.string().max(5000).optional(),
    dealValue: z.coerce.number().positive().optional(),
    dealType: z.enum(dealTypeEnumValues),
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
    status: z.enum(dealStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// ─────────────────────────────────────────────────────────────
// Deal Request Schemas
// ─────────────────────────────────────────────────────────────

const createDealRequestSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(), // deal ID
  }),
  body: z.object({
    requestDetails: z.string().max(5000).optional(),
    requestOffer: z.coerce.number().positive().optional(),
  }),
});

const updateDealRequestSchema = z.object({
  params: z.object({
    dealId: z.coerce.number().int().positive(),
    requestId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      requestDetails: z.string().max(5000).optional(),
      requestOffer: z.coerce.number().positive().optional().nullable(),
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

const listDealRequestsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(), // deal ID
  }),
  query: z.object({
    status: z.enum(dealRequestStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const listMyRequestsSchema = z.object({
  query: z.object({
    status: z.enum(dealRequestStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const withdrawRequestSchema = z.object({
  params: z.object({
    requestId: z.coerce.number().int().positive(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Admin Schemas
// ─────────────────────────────────────────────────────────────

const adminUpdateDealStatusSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum(dealStatusEnumValues),
  }),
});

const adminListDealsSchema = z.object({
  query: z.object({
    status: z.enum(dealStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

module.exports = {
  // Enums
  dealTypeEnumValues,
  dealStatusEnumValues,
  dealRequestStatusEnumValues,
  // Deal schemas
  createDealSchema,
  updateDealSchema,
  searchDealsSchema,
  getDealSchema,
  listMyDealsSchema,
  // Request schemas
  createDealRequestSchema,
  updateDealRequestSchema,
  dealRequestStatusSchema,
  listDealRequestsSchema,
  listMyRequestsSchema,
  withdrawRequestSchema,
  // Admin schemas
  adminUpdateDealStatusSchema,
  adminListDealsSchema,
};
