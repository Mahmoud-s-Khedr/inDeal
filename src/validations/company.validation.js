const { z } = require('zod');

const contactSchema = z.object({
    type: z.string().min(1),
    value: z.string().min(1),
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

const manufacturingStrategyEnumValues = ['makeToStock', 'makeToOrder', 'assembleToOrder', 'engineerToOrder'];

const companyIdParam = z.object({
    id: z
        .string()
        .regex(/^\d+$/, 'Company ID must be numeric'),
});

const updateCompanySchema = z.object({
    body: z
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
        .refine((data) => Object.values(data).some((value) => value !== undefined), {
            message: 'At least one field must be provided',
        }),
});

const addGalleryItemSchema = z.object({
    body: z.object({
        imageFileId: z.coerce.number().int().positive(),
        description: z.string().optional(),
    }),
});

const createReviewSchema = z.object({
    params: companyIdParam,
    body: z.object({
        rating: z.coerce.number().int().min(1).max(5),
        reviewText: z.string().optional(),
    }),
});

const companyIdParamsSchema = z.object({
    params: companyIdParam,
});

const galleryItemParamsSchema = z.object({
    params: z.object({
        galleryItemId: z.coerce.number().int().positive(),
    }),
});

const updateGalleryItemSchema = z.object({
    params: z.object({
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

const documentIdParamsSchema = z.object({
    params: z.object({
        documentId: z.coerce.number().int().positive(),
    }),
});

const createDocumentSchema = z.object({
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

const updateDocumentSchema = z.object({
    params: z.object({
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
            if (providedCertificateFields && data.docType !== undefined && data.docType !== 'certificate') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'title/issuer/url can only be updated when docType is certificate',
                    path: ['docType'],
                });
            }

            if (data.docType === 'certificate') {
                // When explicitly setting docType to certificate, require certificate metadata.
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

const contributionTypeValues = ['product', 'project', 'deal', 'partnership'];

const contributionMediaTypeValues = ['image', 'video', 'file', 'url'];

const contributionIdParamsSchema = z.object({
    params: z.object({
        contributionId: z.coerce.number().int().positive(),
    }),
});

const createContributionSchema = z.object({
    body: z
        .object({
            type: z.enum(contributionTypeValues),
            title: z.string().min(1).max(150),
            description: z.string().optional(),
            mediaFileId: z.coerce.number().int().positive().optional(),
            mediaType: z.enum(contributionMediaTypeValues).optional(),
            mediaUrl: z.string().url().max(255).optional(),
            details: z.object({}).passthrough().optional(),
        })
        .superRefine((data, ctx) => {
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
        }),
});

const updateContributionSchema = z.object({
    params: z.object({
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
        })
        .superRefine((data, ctx) => {
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
                // On update, require mediaFileId only if the client explicitly sets a non-url mediaType.
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
    updateCompanySchema,
    addGalleryItemSchema,
    createReviewSchema,
    companyIdParamsSchema,
    galleryItemParamsSchema,
    updateGalleryItemSchema,
    documentIdParamsSchema,
    createDocumentSchema,
    updateDocumentSchema,
    contributionIdParamsSchema,
    createContributionSchema,
    updateContributionSchema,
};
