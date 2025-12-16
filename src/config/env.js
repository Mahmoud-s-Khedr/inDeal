const { z } = require('zod');
const dotenv = require('dotenv');

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string().default('postgres'),
    DB_NAME: z.string().default('indeal'),

    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    JWT_SECRET: z.string().default('change_this_secret_key_in_production'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    R2_BUCKET_NAME: z.string().default('indeal-assets'),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_ENDPOINT: z.string().optional(),
    R2_REGION: z.string().default('auto'),
    R2_PUBLIC_URL: z.string().optional(),
    R2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 5),
    R2_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),

    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),

    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: z.coerce.boolean().default(false),
    SUPPORT_EMAIL_FROM: z.string().default('no-reply@indeal.local'),
    SUPPORT_EMAIL_NAME: z.string().default('inDeal Support'),
});

const parsed = envSchema.safeParse({
    ...process.env,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
});

if (!parsed.success) {
    console.error('❌ Invalid environment configuration.');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

const env = parsed.data;

module.exports = {
    app: {
        env: env.NODE_ENV,
        port: env.PORT,
    },
    db: {
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        name: env.DB_NAME,
    },
    redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
    },
    jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
    },
    storage: {
        bucket: env.R2_BUCKET_NAME,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        endpoint: env.R2_ENDPOINT,
        region: env.R2_REGION,
        publicUrl: env.R2_PUBLIC_URL,
        signedUrlTtlSeconds: env.R2_SIGNED_URL_TTL_SECONDS,
        maxUploadBytes: env.R2_MAX_FILE_SIZE_BYTES,
    },
    firebase: {
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
    },
    mail: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        secure: env.SMTP_SECURE,
        from: env.SUPPORT_EMAIL_FROM,
        fromName: env.SUPPORT_EMAIL_NAME,
    },
    log: {
        level: env.LOG_LEVEL,
    },
};
