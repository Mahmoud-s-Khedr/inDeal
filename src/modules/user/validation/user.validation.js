const { z } = require('zod');

const updateMeSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      jobTitle: z.string().max(100).optional(),
      preferences: z
        .object({
          language: z.enum(['en', 'ar']).optional(),
          theme: z.enum(['light', 'dark']).optional(),
        })
        .optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

const updatePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
  }),
});

const updateProfileImageSchema = z.object({
  body: z.object({
    profileImageFileId: z.coerce.number().int().positive(),
  }),
});

module.exports = {
  updateMeSchema,
  updatePasswordSchema,
  updateProfileImageSchema,
};
