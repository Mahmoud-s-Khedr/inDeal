const { z } = require('zod');

const contactSchema = z.object({
  type: z.string().min(1),
  value: z.string().min(1),
});

const documentSchema = z.object({
  fileId: z.coerce.number().int().positive(),
  docType: z
    .string()
    .max(100)
    .refine((val) => !val.startsWith('registration:'), {
      message: 'docType must not start with "registration:"',
    })
    .optional(),
  description: z.string().max(255).optional(),
  expiryDate: z.coerce.date().optional(),
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

const normalizeEnumInput = (value, enumValues) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const normalizeKey = (entry) => entry.toLowerCase().replace(/[^a-z0-9]/g, '');
  const byNormalizedKey = Object.fromEntries(
    enumValues.map((entry) => [normalizeKey(entry), entry])
  );
  return byNormalizedKey[normalizeKey(trimmed)] || trimmed;
};

const normalizedIndustryEnumSchema = z.preprocess(
  (value) => normalizeEnumInput(value, industryEnumValues),
  z.enum(industryEnumValues)
);

const manufacturingStrategyEnumValues = [
  'makeToStock',
  'makeToOrder',
  'assembleToOrder',
  'engineerToOrder',
];

const registerSchema = z.object({
  body: z.object({
    user: z.object({
      username: z.string().min(3).max(50),
      email: z.string().email(),
      password: z.string().min(8),
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
      jobTitle: z.string().max(100).optional(),
    }),
    company: z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().max(20).optional(),
      website: z.string().url().max(100).optional(),
      companyType: z.enum(companyTypeEnumValues).optional(),
      companyIndustry: normalizedIndustryEnumSchema.optional(),
      manufacturingStrategy: z.enum(manufacturingStrategyEnumValues).optional(),
      contacts: z.array(contactSchema).optional(),
      locations: z.array(z.string().min(1)).optional(),
      documents: z
        .array(documentSchema)
        .min(1, 'At least one document must be provided')
        .optional(),
    }),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z
  .object({
    body: z.object({
      email: z.string().email(),
      otp: z.string().regex(/^\d{6}$/, { message: 'OTP must be a 6-digit code' }),
      password: z.string().min(8),
      confirmPassword: z.string().min(8),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.body.password !== data.body.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body', 'confirmPassword'],
        message: 'Passwords must match',
      });
    }
  });

const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/, { message: 'OTP must be a 6-digit code' }),
  }),
});

const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/, { message: 'OTP must be a 6-digit code' }),
  }),
});

const verifyEmailQuerySchema = z.object({
  query: z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/, { message: 'OTP must be a 6-digit code' }),
  }),
});

const resubmitSchema = z.object({
  body: z.object({
    company: z
      .object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().max(20).optional(),
        website: z.string().url().max(100).optional(),
        companyType: z.enum(companyTypeEnumValues).optional(),
        companyIndustry: normalizedIndustryEnumSchema.optional(),
        manufacturingStrategy: z.enum(manufacturingStrategyEnumValues).optional(),
        contacts: z.array(contactSchema).optional(),
        locations: z.array(z.string().min(1)).optional(),
      })
      .optional(),
    documents: z.array(documentSchema).min(1, 'At least one document must be provided'),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  verifyEmailQuerySchema,
  resubmitSchema,
};
