const { z } = require('zod');

const userRoleEnum = ['agent', 'admin', 'support'];
const userStatusEnum = ['pending', 'verified', 'suspended'];
const companyStatusEnum = ['active', 'underReview', 'rejected', 'suspended'];
const dealStatusEnum = ['open', 'closed', 'archived'];
const analyticsPeriodEnum = ['7d', '30d', '90d'];

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const numericId = z.coerce.number().int().positive();

const listUsersSchema = z.object({
  query: z.object({
    role: z.enum(userRoleEnum).optional(),
    status: z.enum(userStatusEnum).optional(),
    keyword: z.string().trim().max(200).optional(),
    ...paginationQuery,
  }),
});

const userIdParamsSchema = z.object({
  params: z.object({
    id: numericId,
  }),
});

const updateUserStatusSchema = z.object({
  params: z.object({
    id: numericId,
  }),
  body: z.object({
    status: z.enum(userStatusEnum),
  }),
});

const updateUserRoleSchema = z.object({
  params: z.object({
    id: numericId,
  }),
  body: z.object({
    role: z.enum(userRoleEnum),
  }),
});

const listCompaniesSchema = z.object({
  query: z.object({
    status: z.enum(companyStatusEnum).optional(),
    companyType: z.string().trim().max(50).optional(),
    keyword: z.string().trim().max(200).optional(),
    ...paginationQuery,
  }),
});

const companyIdParamsSchema = z.object({
  params: z.object({
    id: numericId,
  }),
});

const updateCompanyStatusSchema = z.object({
  params: z.object({
    id: numericId,
  }),
  body: z
    .object({
      status: z.enum(companyStatusEnum),
      rejectionReason: z.string().trim().max(1000).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.status === 'rejected' && !value.rejectionReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'rejectionReason is required when rejecting a company',
          path: ['rejectionReason'],
        });
      }
    }),
});

const listDealsSchema = z.object({
  query: z.object({
    status: z.enum(dealStatusEnum).optional(),
    dealType: z.string().trim().max(16).optional(),
    companyId: numericId.optional(),
    keyword: z.string().trim().max(200).optional(),
    ...paginationQuery,
  }),
});

const dealIdParamsSchema = z.object({
  params: z.object({
    id: numericId,
  }),
});

const updateDealStatusSchema = z.object({
  params: z.object({
    id: numericId,
  }),
  body: z.object({
    status: z.enum(dealStatusEnum),
  }),
});

const analyticsPeriodSchema = z.object({
  query: z.object({
    period: z.enum(analyticsPeriodEnum).default('30d'),
  }),
});

const listEmailLogsSchema = z.object({
  query: z.object({
    status: z.string().trim().max(20).optional(),
    template: z.string().trim().max(50).optional(),
    recipient: z.string().trim().max(255).optional(),
    ...paginationQuery,
  }),
});

const emailLogIdParamsSchema = z.object({
  params: z.object({
    id: numericId,
  }),
});

module.exports = {
  listUsersSchema,
  userIdParamsSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  listCompaniesSchema,
  companyIdParamsSchema,
  updateCompanyStatusSchema,
  listDealsSchema,
  dealIdParamsSchema,
  updateDealStatusSchema,
  analyticsPeriodSchema,
  listEmailLogsSchema,
  emailLogIdParamsSchema,
};
