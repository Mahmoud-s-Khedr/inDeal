/**
 * Startup Logger Utility
 *
 * Logs application configuration on startup with sensitive values masked.
 * Helps debug deployment issues and verify configuration.
 */

const logger = require('./logger');
const config = require('../config/env');

// Fields that should be fully masked
const MASK_FIELDS = [
  'password',
  'secret',
  'privateKey',
  'apiKey',
  'accessKeyId',
  'secretAccessKey',
];

// Fields that should show partial value (first 4 chars)
const PARTIAL_MASK_FIELDS = ['host', 'endpoint'];

/**
 * Mask sensitive value
 */
const maskValue = (key, value) => {
  if (value === undefined || value === null) return '[not set]';
  if (typeof value !== 'string') return value;

  const lowerKey = key.toLowerCase();

  // Full mask for sensitive fields
  for (const field of MASK_FIELDS) {
    if (lowerKey.includes(field.toLowerCase())) {
      return '[REDACTED]';
    }
  }

  // Partial mask for semi-sensitive fields
  for (const field of PARTIAL_MASK_FIELDS) {
    if (lowerKey.includes(field.toLowerCase()) && value.length > 8) {
      return value.substring(0, 8) + '...';
    }
  }

  return value;
};

/**
 * Recursively mask sensitive values in an object
 */
const maskObject = (obj, prefix = '') => {
  if (typeof obj !== 'object' || obj === null) {
    return maskValue(prefix, obj);
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = maskObject(value, fullKey);
    } else {
      result[key] = maskValue(key, value);
    }
  }
  return result;
};

/**
 * Log startup configuration
 */
const logStartupConfig = () => {
  const sanitizedConfig = {
    environment: config.app.env,
    port: config.app.port,
    logLevel: config.log.level,
    database: {
      host: maskValue('host', config.db.host),
      port: config.db.port,
      name: config.db.name,
      user: config.db.user,
    },
    redis: {
      host: maskValue('host', config.redis.host),
      port: config.redis.port,
      hasPassword: !!config.redis.password,
    },
    storage: {
      bucket: config.storage.bucket,
      endpoint: maskValue('endpoint', config.storage.endpoint),
      hasCredentials: !!(config.storage.accessKeyId && config.storage.secretAccessKey),
      publicUrl: config.storage.publicUrl,
    },
    firebase: {
      projectId: config.firebase.projectId || '[not configured]',
      hasCredentials: !!(config.firebase.clientEmail && config.firebase.privateKey),
    },
    email: {
      hasResendKey: !!config.resend.apiKey,
      fromEmail: config.resend.fromEmail,
    },
    session: {
      accessTtlMinutes: config.session.accessTtlMinutes,
      refreshTtlDays: config.session.refreshTtlDays,
      enforceLatestJti: config.session.enforceLatestJti,
    },
    features: {
      forgotPasswordEnabled: config.forgotPassword.enabled,
      passwordHistoryDepth: config.passwordHistory.depth,
    },
  };

  logger.info(sanitizedConfig, 'Server configuration loaded');
};

/**
 * Log database connection status
 */
const logDatabaseConnected = (host, database) => {
  logger.info({ database: { host, name: database } }, 'Database connection verified');
};

/**
 * Log Redis/Valkey connection status
 */
const logRedisConnected = (host, port) => {
  logger.info({ redis: { host, port } }, 'Redis/Valkey connection ready');
};

/**
 * Log server listening
 */
const logServerListening = (port, env) => {
  logger.info({ port, environment: env }, `Server running on port ${port} (${env})`);
};

/**
 * Log worker started
 */
const logWorkerStarted = (workerName) => {
  logger.info({ worker: workerName }, `Background worker started: ${workerName}`);
};

/**
 * Log graceful shutdown
 */
const logShutdown = (signal) => {
  logger.warn({ signal }, `${signal} received. Shutting down gracefully...`);
};

module.exports = {
  logStartupConfig,
  logDatabaseConnected,
  logRedisConnected,
  logServerListening,
  logWorkerStarted,
  logShutdown,
  maskObject,
  maskValue,
};
