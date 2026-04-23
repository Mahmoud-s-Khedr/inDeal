const { z } = require('zod');

const companyIdParamsSchema = z.object({
  params: z.object({
    companyId: z.coerce.number().int().positive(),
  }),
});

const updateReviewRequestSchema = z.object({
  params: z.object({
    companyId: z.coerce.number().int().positive(),
  }),
  body: z
    .object({
      action: z.enum(['approve', 'reject']),
      reason: z.string().min(3).max(1000).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.action === 'reject' && !data.reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'reason is required when action is reject',
        });
      }
    }),
});

module.exports = {
  companyIdParamsSchema,
  updateReviewRequestSchema,
};
