/**
 * Pino Logger Configuration
 * High-performance JSON logger with environment-aware formatting
 * Supports console output, file rotation, and multi-stream logging
 */

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { app: appConfig, log: logConfig } = require('./env');

// Map our log levels to Pino levels
const levelMapping = {
    error: 'error',
    warn: 'warn',
    http: 'info', // HTTP logs at info level in Pino
    info: 'info',
    debug: 'debug',
};

// Sensitive fields to redact from logs
const REDACT_PATHS = [
    'password',
    'newPassword',
    'confirmPassword',
    'currentPassword',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secret',
    'authorization',
    'req.headers.authorization',
    'req.body.password',
    'req.body.newPassword',
    'req.body.confirmPassword',
    'req.body.currentPassword',
    'res.body.token',
    'res.body.accessToken',
    'res.body.refreshToken',
];

// Base configuration shared across environments
const baseConfig = {
    level: levelMapping[logConfig.level] || 'info',
    base: {
        app: 'indeal-api',
        env: appConfig.env,
        pid: process.pid,
    },
    redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label }),
    },
};

/**
 * Parse max size string (e.g., "10M", "100K", "1G") to bytes
 */
const parseMaxSize = (sizeStr) => {
    const units = { K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+)([KMG])?$/i);
    if (!match) return 10 * 1024 * 1024; // Default 10MB
    const num = parseInt(match[1], 10);
    const unit = match[2] ? units[match[2].toUpperCase()] : 1;
    return num * unit;
};

/**
 * Ensure log directory exists
 */
const ensureLogDir = (logPath) => {
    const dir = path.resolve(logPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};

/**
 * Build transport configuration based on environment settings
 */
const buildTransport = () => {
    const usePrettyFormat = logConfig.format === 'pretty' ||
        (logConfig.format !== 'json' && appConfig.env === 'development');

    // If file logging is disabled, use simple console transport
    if (!logConfig.file.enabled) {
        if (usePrettyFormat) {
            return {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    singleLine: false,
                },
            };
        }
        return undefined; // Use stdout directly for JSON
    }

    // File logging enabled - use multi-stream transport
    const logDir = ensureLogDir(logConfig.file.path);
    const targets = [];

    // Console output
    if (usePrettyFormat) {
        targets.push({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                singleLine: false,
            },
        });
    } else {
        targets.push({
            target: 'pino/file',
            options: { destination: 1 }, // stdout
        });
    }

    // Rotating file output
    targets.push({
        target: 'pino/file',
        options: {
            destination: path.join(logDir, 'app.log'),
            mkdir: true,
        },
    });

    // Error-only file (for easier debugging)
    targets.push({
        target: 'pino/file',
        level: 'error',
        options: {
            destination: path.join(logDir, 'error.log'),
            mkdir: true,
        },
    });

    return { targets };
};

// Build transport configuration
const transport = buildTransport();

// Create the logger
const logger = transport
    ? pino({ ...baseConfig, transport })
    : pino(baseConfig);

/**
 * Create a child logger with additional context
 * @param {Object} bindings - Context to bind to the child logger
 * @returns {pino.Logger} Child logger instance
 */
const createChildLogger = (bindings) => logger.child(bindings);

/**
 * Create a request-scoped logger
 * @param {string} requestId - Unique request identifier
 * @param {Object} [additionalContext] - Additional context to bind
 * @returns {pino.Logger} Request-scoped child logger
 */
const createRequestLogger = (requestId, additionalContext = {}) =>
    logger.child({ requestId, ...additionalContext });

/**
 * Create a service-scoped logger for external services
 * @param {string} serviceName - Name of the external service (e.g., 'r2', 'firebase', 'resend')
 * @returns {pino.Logger} Service-scoped child logger
 */
const createServiceLogger = (serviceName) =>
    logger.child({ service: serviceName });

module.exports = {
    logger,
    createChildLogger,
    createRequestLogger,
    createServiceLogger,
    REDACT_PATHS,
};
