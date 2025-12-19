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

module.exports = {
    updateCompanySchema,
    addGalleryItemSchema,
    createReviewSchema,
    companyIdParamsSchema,
};
