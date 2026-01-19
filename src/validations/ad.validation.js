const { z } = require('zod');

// ─────────────────────────────────────────────────────────────
// Enum values
// ─────────────────────────────────────────────────────────────

const adStatusEnumValues = ['pending', 'active', 'rejected', 'paused', 'completed'];
const adLocationEnumValues = ['homepage_banner', 'sidebar', 'search_result'];
const adTypeEnumValues = ['banner', 'video', 'sponsored_listing'];

// ─────────────────────────────────────────────────────────────
// Create Ad Schema
// ─────────────────────────────────────────────────────────────

const createAdSchema = z.object({
  body: z
    .object({
      title: z.string().min(1).max(100),
      content: z.string().max(2000).optional(),
      imageFileId: z.coerce.number().int().positive().optional(),
      targetUrl: z.string().url().max(255).optional(),
      location: z.enum(adLocationEnumValues),
      type: z.enum(adTypeEnumValues),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .refine(
      (data) => {
        // If both dates provided, end must be after start
        if (data.startDate && data.endDate) {
          return data.endDate >= data.startDate;
        }
        return true;
      },
      { message: 'End date must be after start date' }
    ),
});

// ─────────────────────────────────────────────────────────────
// Update Ad Schema
// ─────────────────────────────────────────────────────────────

const updateAdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      title: z.string().min(1).max(100).optional(),
      content: z.string().max(2000).optional(),
      imageFileId: z.coerce.number().int().positive().optional(),
      targetUrl: z.string().url().max(255).optional(),
      location: z.enum(adLocationEnumValues).optional(),
      type: z.enum(adTypeEnumValues).optional(),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
});

// ─────────────────────────────────────────────────────────────
// Get Ad Schema
// ─────────────────────────────────────────────────────────────

const getAdSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// ─────────────────────────────────────────────────────────────
// List My Ads Schema
// ─────────────────────────────────────────────────────────────

const listMyAdsSchema = z.object({
  query: z.object({
    status: z.enum(adStatusEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

// ─────────────────────────────────────────────────────────────
// List Active Ads (Public)
// ─────────────────────────────────────────────────────────────

const listActiveAdsSchema = z.object({
  query: z.object({
    location: z.enum(adLocationEnumValues).optional(),
    type: z.enum(adTypeEnumValues).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  }),
});

// ─────────────────────────────────────────────────────────────
// Record Click Schema
// ─────────────────────────────────────────────────────────────

const recordClickSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Analytics Schema
// ─────────────────────────────────────────────────────────────

const getAnalyticsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  query: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Admin Schemas
// ─────────────────────────────────────────────────────────────

const adminListAdsSchema = z.object({
  query: z.object({
    status: z.enum(adStatusEnumValues).optional(),
    companyId: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

const adminUpdateAdStatusSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    status: z.enum(adStatusEnumValues),
  }),
});

module.exports = {
  adStatusEnumValues,
  adLocationEnumValues,
  adTypeEnumValues,
  createAdSchema,
  updateAdSchema,
  getAdSchema,
  listMyAdsSchema,
  listActiveAdsSchema,
  recordClickSchema,
  getAnalyticsSchema,
  adminListAdsSchema,
  adminUpdateAdStatusSchema,
};
