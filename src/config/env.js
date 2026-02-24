const { z } = require('zod');
const dotenv = require('dotenv');

dotenv.config();

const emptyStringToUndefined = (val) => (val === '' ? undefined : val);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Logging configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
  LOG_REQUEST_BODY: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(true),
  LOG_RESPONSE_BODY: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(true),
  LOG_SLOW_QUERY_MS: z.coerce.number().int().nonnegative().default(1000),
  LOG_FILE_ENABLED: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false),
  LOG_FILE_PATH: z.string().default('./logs'),
  LOG_FILE_MAX_SIZE: z.string().default('10M'),
  LOG_FILE_MAX_FILES: z.coerce.number().int().positive().default(7),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('indeal'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),

  JWT_SECRET: z.string().default('change_this_secret_key_in_production'),
  JWT_EXPIRES_IN: z.string().default('5m'),
  JWT_ROTATE_BEFORE_EXP_SECONDS: z.coerce.number().int().positive().default(60),

  SESSION_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_ROTATE_LEEWAY_SECONDS: z.coerce.number().int().nonnegative().default(300),
  SESSION_MULTI_DEVICE_ENABLED: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(true),
  SESSION_LEGACY_FALLBACK_ENABLED: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(true),

  R2_BUCKET_NAME: z.string().default('indeal-assets'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  R2_REGION: z.string().default('auto'),
  R2_PUBLIC_URL: z.string().optional(),
  R2_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 5),
  R2_MAX_FILE_SIZE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(20 * 1024 * 1024),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('no-reply@indeal.local'),
  RESEND_FROM_NAME: z.string().default('inDeal Support'),

  COMPANY_REVIEW_NOTIFICATION_EMAIL: z.preprocess(
    emptyStringToUndefined,
    z.string().email().optional()
  ),

  FRONTEND_BASE_URL: z.string().url().default('https://app.indeal.local'),
  FORGOT_PASSWORD_ENABLED: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(true),
  FORGOT_PASSWORD_OTP_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  FORGOT_PASSWORD_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60),
  FORGOT_PASSWORD_RATE_LIMIT_FORGOT_PER_EMAIL: z.coerce.number().int().positive().default(5),
  FORGOT_PASSWORD_RATE_LIMIT_FORGOT_PER_IP: z.coerce.number().int().positive().default(10),
  FORGOT_PASSWORD_RATE_LIMIT_RESET_PER_EMAIL: z.coerce.number().int().positive().default(10),
  FORGOT_PASSWORD_RATE_LIMIT_RESET_PER_IP: z.coerce.number().int().positive().default(15),
  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 24),
  EMAIL_VERIFICATION_API_BASE_URL: z.string().url().default('http://localhost:3000'),
  EMAIL_VERIFICATION_PATH: z.string().default('/api/v1/auth/verify-email'),

  PASSWORD_HISTORY_DEPTH: z.coerce.number().int().nonnegative().default(5),
  PASSWORD_HISTORY_PRUNE_KEEP: z.coerce.number().int().positive().default(10),

  FILE_RETENTION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60), // 7 days

  IMAGE_THUMB_SIZE: z.coerce.number().int().positive().default(150),
  IMAGE_MEDIUM_SIZE: z.coerce.number().int().positive().default(600),
  IMAGE_QUALITY: z.coerce.number().int().min(1).max(100).default(85),

  CHAT_MASTER_KEY: z.string().length(64).optional(),
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
    username: env.REDIS_USERNAME,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    rotateBeforeExpSeconds: env.JWT_ROTATE_BEFORE_EXP_SECONDS,
  },
  session: {
    refreshTtlDays: env.SESSION_REFRESH_TTL_DAYS,
    rotateLeewaySeconds: env.SESSION_ROTATE_LEEWAY_SECONDS,
    multiDeviceEnabled: env.SESSION_MULTI_DEVICE_ENABLED,
    legacyFallbackEnabled: env.SESSION_LEGACY_FALLBACK_ENABLED,
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
  resend: {
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.RESEND_FROM_EMAIL,
    fromName: env.RESEND_FROM_NAME,
  },
  companyReview: {
    notificationEmail: env.COMPANY_REVIEW_NOTIFICATION_EMAIL,
  },
  log: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
    requestBody: env.LOG_REQUEST_BODY,
    responseBody: env.LOG_RESPONSE_BODY,
    slowQueryMs: env.LOG_SLOW_QUERY_MS,
    file: {
      enabled: env.LOG_FILE_ENABLED,
      path: env.LOG_FILE_PATH,
      maxSize: env.LOG_FILE_MAX_SIZE,
      maxFiles: env.LOG_FILE_MAX_FILES,
    },
  },
  forgotPassword: {
    enabled: env.FORGOT_PASSWORD_ENABLED,
    frontendUrl: env.FRONTEND_BASE_URL,
    otpTtlMinutes: env.FORGOT_PASSWORD_OTP_TTL_MINUTES,
    maxAttempts: env.FORGOT_PASSWORD_MAX_ATTEMPTS,
    rateLimits: {
      windowSeconds: env.FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS,
      forgotPerEmail: env.FORGOT_PASSWORD_RATE_LIMIT_FORGOT_PER_EMAIL,
      forgotPerIp: env.FORGOT_PASSWORD_RATE_LIMIT_FORGOT_PER_IP,
      resetPerEmail: env.FORGOT_PASSWORD_RATE_LIMIT_RESET_PER_EMAIL,
      resetPerIp: env.FORGOT_PASSWORD_RATE_LIMIT_RESET_PER_IP,
    },
  },
  emailVerification: {
    tokenTtlMinutes: env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
    baseUrl: env.EMAIL_VERIFICATION_API_BASE_URL,
    route: env.EMAIL_VERIFICATION_PATH,
  },
  passwordHistory: {
    depth: env.PASSWORD_HISTORY_DEPTH,
    pruneKeep: env.PASSWORD_HISTORY_PRUNE_KEEP,
  },
  fileRetentionSeconds: env.FILE_RETENTION_SECONDS,
  imageOptimization: {
    thumbSize: env.IMAGE_THUMB_SIZE,
    mediumSize: env.IMAGE_MEDIUM_SIZE,
    quality: env.IMAGE_QUALITY,
  },
};
