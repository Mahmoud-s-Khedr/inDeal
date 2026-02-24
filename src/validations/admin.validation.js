const { z } = require('zod');

const companyIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const companyParamsSchema = z.object({
  params: companyIdSchema,
});

const reviewCompanyStatusSchema = z.object({
  params: companyIdSchema,
  body: z.object({
    status: z.enum(['active', 'underReview', 'rejected', 'suspended']),
    reason: z.string().min(1).max(500).optional(),
  }),
});

const rejectCompanySchema = z.object({
  params: companyIdSchema,
  body: z.object({
    reason: z.string().min(1).max(500).optional(),
  }),
});

const changeCompanyAgentSchema = z.object({
  params: companyIdSchema,
  body: z.object({
    agentId: z.coerce.number().int().positive(),
  }),
});

const changeAgentEmailSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    email: z.string().email(),
  }),
});

const updateCompanySchema = z.object({
  params: companyIdSchema,
  body: z
    .object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().max(20).optional(),
      website: z.string().url().max(100).optional(),
      companyType: z.string().optional(),
      companyIndustry: z.string().optional(),
      manufacturingStrategy: z.string().optional(),
      contacts: z.array(z.object({ type: z.string().min(1), value: z.string().min(1) })).optional(),
      locations: z.array(z.string().min(1)).optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

const updateCompanySummarySchema = z.object({
  params: companyIdSchema,
  body: z.object({
    summary: z.string().min(1),
  }),
});

const galleryItemParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    galleryItemId: z.coerce.number().int().positive(),
  }),
});

const createCompanyGalleryItemSchema = z.object({
  params: companyIdSchema,
  body: z.object({
    imageFileId: z.coerce.number().int().positive(),
    description: z.string().optional(),
  }),
});

const updateCompanyGalleryItemSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    galleryItemId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      imageFileId: z.coerce.number().int().positive().optional(),
      description: z.string().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

const documentParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    documentId: z.coerce.number().int().positive(),
  }),
});

const registrationDocumentParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    registrationDocumentId: z.coerce.number().int().positive(),
  }),
});

const createCompanyDocumentSchema = z.object({
  params: companyIdSchema,
  body: z
    .object({
      fileId: z.coerce.number().int().positive().optional(),
      docType: z.string().max(100).optional(),
      title: z.string().min(1).max(150).optional(),
      issuer: z.string().min(1).max(150).optional(),
      url: z.string().url().max(255).optional(),
      description: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const isCertificate = data.docType === 'certificate';

      if (!isCertificate) {
        if (!data.fileId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'fileId is required unless docType is certificate with a url',
            path: ['fileId'],
          });
        }

        if (data.title !== undefined || data.issuer !== undefined || data.url !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'title/issuer/url are only allowed when docType is certificate',
            path: ['docType'],
          });
        }
        return;
      }

      if (!data.title) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'title is required for certificate',
          path: ['title'],
        });
      }

      if (!data.issuer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'issuer is required for certificate',
          path: ['issuer'],
        });
      }

      if (!data.fileId && !data.url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Either fileId or url is required for certificate',
          path: ['fileId'],
        });
      }
    }),
});

const updateCompanyDocumentSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    documentId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      fileId: z.coerce.number().int().positive().optional(),
      docType: z.string().max(100).optional(),
      title: z.string().min(1).max(150).optional(),
      issuer: z.string().min(1).max(150).optional(),
      url: z.string().url().max(255).optional(),
      description: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const providedCertificateFields =
        data.title !== undefined || data.issuer !== undefined || data.url !== undefined;
      // For updates, allow sending certificate fields without re-sending docType,
      // because the validator doesn't know the existing record type.
      // If docType is explicitly provided and it's not 'certificate', reject.
      if (
        providedCertificateFields &&
        data.docType !== undefined &&
        data.docType !== 'certificate'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'title/issuer/url can only be updated when docType is certificate',
          path: ['docType'],
        });
      }

      if (data.docType === 'certificate') {
        if (!data.title) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'title is required when setting docType to certificate',
            path: ['title'],
          });
        }
        if (!data.issuer) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'issuer is required when setting docType to certificate',
            path: ['issuer'],
          });
        }
        if (!data.fileId && !data.url) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Either fileId or url is required when setting docType to certificate',
            path: ['fileId'],
          });
        }
      }
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

const updateCompanyRegistrationDocumentSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    registrationDocumentId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      fileId: z.coerce.number().int().positive().optional(),
      docType: z.string().max(100).optional(),
      description: z.string().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

const contributionTypeValues = ['product', 'project', 'deal', 'partnership'];

const contributionMediaTypeValues = ['image', 'video', 'file', 'url'];

const contributionParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    contributionId: z.coerce.number().int().positive(),
  }),
});

const createCompanyContributionSchema = z.object({
  params: companyIdSchema,
  body: z
    .object({
      type: z.enum(contributionTypeValues),
      title: z.string().min(1).max(150),
      description: z.string().optional(),
      mediaFileId: z.coerce.number().int().positive().optional(),
      mediaType: z.enum(contributionMediaTypeValues).optional(),
      mediaUrl: z.string().url().max(255).optional(),
      details: z.object({}).passthrough().optional(),
      partnerId: z.coerce.number().int().positive().optional(),
      partnerName: z.string().max(100).optional(),
      contributors: z.array(z.string().min(1)).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === 'partnership' && !data.partnerId && !data.partnerName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'partnerId or partnerName is required when type is partnership',
          path: ['partnerId'],
        });
      }

      if (data.mediaUrl !== undefined && data.mediaType !== 'url') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mediaUrl is only allowed when mediaType is url',
          path: ['mediaType'],
        });
      }

      if (data.mediaType === 'url') {
        if (!data.mediaUrl) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'mediaUrl is required when mediaType is url',
            path: ['mediaUrl'],
          });
        }
        if (data.mediaFileId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'mediaFileId cannot be used when mediaType is url',
            path: ['mediaFileId'],
          });
        }
      }

      if (data.mediaType && data.mediaType !== 'url' && !data.mediaFileId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mediaFileId is required when mediaType is image/video/file',
          path: ['mediaFileId'],
        });
      }

      if (data.type === 'project') {
        if (!Array.isArray(data.contributors) || data.contributors.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'contributors must contain at least one name when type is project',
            path: ['contributors'],
          });
        }
      }
    }),
});

const updateCompanyContributionSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    contributionId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      type: z.enum(contributionTypeValues).optional(),
      title: z.string().min(1).max(150).optional(),
      description: z.string().optional(),
      mediaFileId: z.coerce.number().int().positive().optional(),
      mediaType: z.enum(contributionMediaTypeValues).optional(),
      mediaUrl: z.string().url().max(255).optional(),
      details: z.object({}).passthrough().optional(),
      partnerId: z.coerce.number().int().positive().optional(),
      partnerName: z.string().max(100).optional(),
      contributors: z.array(z.string().min(1)).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.type === 'partnership' && !data.partnerId && !data.partnerName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'partnerId or partnerName is required when type is partnership',
          path: ['partnerId'],
        });
      }

      // For updates, allow mediaUrl without re-sending mediaType,
      // because the validator doesn't know the existing record's mediaType.
      // If mediaType is explicitly provided and it's not 'url', reject.
      if (data.mediaUrl !== undefined && data.mediaType !== undefined && data.mediaType !== 'url') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mediaUrl is only allowed when mediaType is url',
          path: ['mediaType'],
        });
      }

      if (data.mediaType === 'url') {
        if (!data.mediaUrl) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'mediaUrl is required when mediaType is url',
            path: ['mediaUrl'],
          });
        }
        if (data.mediaFileId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'mediaFileId cannot be used when mediaType is url',
            path: ['mediaFileId'],
          });
        }
      }

      if (data.mediaType && data.mediaType !== 'url' && data.mediaFileId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mediaFileId is required when setting mediaType to image/video/file',
          path: ['mediaFileId'],
        });
      }
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

module.exports = {
  companyParamsSchema,
  reviewCompanyStatusSchema,
  rejectCompanySchema,
  changeCompanyAgentSchema,
  updateCompanySchema,
  updateCompanySummarySchema,
  createCompanyGalleryItemSchema,
  updateCompanyGalleryItemSchema,
  galleryItemParamsSchema,
  createCompanyDocumentSchema,
  updateCompanyDocumentSchema,
  documentParamsSchema,
  registrationDocumentParamsSchema,
  updateCompanyRegistrationDocumentSchema,
  createCompanyContributionSchema,
  updateCompanyContributionSchema,
  contributionParamsSchema,
  changeAgentEmailSchema,
};
