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
        status: z.enum(['active', 'rejected', 'suspended']),
    }),
});

const changeCompanyAgentSchema = z.object({
    params: companyIdSchema,
    body: z.object({
        agentId: z.coerce.number().int().positive(),
    }),
});

module.exports = {
    companyParamsSchema,
    reviewCompanyStatusSchema,
    changeCompanyAgentSchema,
};
