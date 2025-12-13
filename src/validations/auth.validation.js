const { z } = require('zod');

const contactSchema = z.object({
    type: z.string().min(1),
    value: z.string().min(1),
});

const registerSchema = z.object({
    body: z.object({
        user: z.object({
            username: z.string().min(3).max(50),
            email: z.string().email(),
            password: z.string().min(8),
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            jobTitle: z.string().max(100).optional(),
        }),
        company: z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
            website: z.string().url().optional(),
            companyType: z.string().optional(),
            companyIndustry: z.string().optional(),
            manufacturingStrategy: z.string().optional(),
            contacts: z.array(contactSchema).optional(),
            locations: z.array(z.string().min(1)).optional(),
        }),
    }),
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
    }),
});

module.exports = {
    registerSchema,
    loginSchema,
};
