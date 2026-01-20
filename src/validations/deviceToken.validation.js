/**
 * Device Token Validation Schemas
 */

const { z } = require('zod');

const registerDeviceSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'Token is required').max(500),
        deviceType: z.enum(['ios', 'android', 'web'], {
            errorMap: () => ({ message: 'Device type must be ios, android, or web' }),
        }),
        deviceInfo: z
            .object({
                model: z.string().optional(),
                os: z.string().optional(),
                appVersion: z.string().optional(),
            })
            .optional(),
    }),
});

const unregisterDeviceSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'Token is required'),
    }),
});

module.exports = {
    registerDeviceSchema,
    unregisterDeviceSchema,
};
