/**
 * Logger Utility - Pino Wrapper
 * 
 * Provides a consistent logging API that wraps Pino.
 * Maintains backward compatibility with existing logger.info(), logger.error() calls.
 */

const { logger, createChildLogger, createRequestLogger, createServiceLogger } = require('../config/pino');

/**
 * Format meta data for logging
 * Ensures Error objects are properly serialized
 */
const formatMeta = (meta) => {
    if (!meta) return undefined;
    if (meta instanceof Error) {
        return {
            type: meta.constructor.name,
            message: meta.message,
            stack: meta.stack,
            ...(meta.statusCode && { statusCode: meta.statusCode }),
            ...(meta.code && { code: meta.code }),
        };
    }
    return meta;
};

/**
 * Log at specified level with optional metadata
 */
const write = (level, message, meta) => {
    const formattedMeta = formatMeta(meta);

    // Pino uses different method names than our custom levels
    // Map 'http' to 'info' 
    const pinoLevel = level === 'http' ? 'info' : level;

    if (formattedMeta !== undefined) {
        logger[pinoLevel](formattedMeta, message);
    } else {
        logger[pinoLevel](message);
    }
};

module.exports = {
    // Core Pino logger instance (for advanced use)
    pino: logger,

    // Child logger factories
    createChildLogger,
    createRequestLogger,
    createServiceLogger,

    // Main logging API (backward compatible)
    log: write,
    error: (message, meta) => write('error', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    http: (message, meta) => write('info', message, meta), // HTTP logs at info level
    info: (message, meta) => write('info', message, meta),
    debug: (message, meta) => write('debug', message, meta),

    // Convenience method for structured logging
    child: (bindings) => createChildLogger(bindings),
};
