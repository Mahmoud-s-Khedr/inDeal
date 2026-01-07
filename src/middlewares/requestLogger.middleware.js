/**
 * Request Logger Middleware
 * 
 * Provides comprehensive HTTP request/response logging with:
 * - Unique request ID (correlation ID)
 * - Request body logging (with sensitive field masking via Pino redaction)
 * - Response body logging (with size limits)
 * - Response timing
 * - Authentication context
 */

const { v4: uuidv4 } = require('uuid');
const { createRequestLogger, REDACT_PATHS } = require('../config/pino');
const { log: logConfig } = require('../config/env');

// Maximum response body size to log (in characters)
const MAX_RESPONSE_BODY_SIZE = 4096;

// Content types to log bodies for
const LOGGABLE_CONTENT_TYPES = [
    'application/json',
    'application/x-www-form-urlencoded',
];

/**
 * Safely serialize data for logging
 */
const safeSerialize = (value) => {
    if (value === undefined || value === null) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return '[unserializable]';
    }
};

/**
 * Check if content type is loggable
 */
const isLoggableContentType = (contentType) => {
    if (!contentType) return false;
    return LOGGABLE_CONTENT_TYPES.some((type) => contentType.includes(type));
};

/**
 * Truncate string to max length
 */
const truncate = (str, maxLength) => {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '... [truncated]';
};

/**
 * Get client IP address from request
 */
const getClientIp = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        req.ip
    );
};

/**
 * Request logger middleware
 */
const requestLogger = (req, res, next) => {
    // Generate unique request ID
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Capture start time
    const startTime = process.hrtime.bigint();

    // Create request-scoped logger
    const log = createRequestLogger(requestId);
    req.log = log;

    // Capture response body
    const originalSend = res.send;
    let responseBody;

    res.send = function (body) {
        responseBody = body;
        res.locals.responseData = body;
        return originalSend.apply(this, arguments);
    };

    // Log on response finish
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const responseTimeMs = Number(endTime - startTime) / 1e6;

        // Build log payload
        const logPayload = {
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            responseTimeMs: Math.round(responseTimeMs * 100) / 100,
            contentLength: res.get('content-length') || 0,
            ip: getClientIp(req),
            userAgent: req.get('user-agent'),
        };

        // Add request body if present and enabled
        if (req.body && Object.keys(req.body).length > 0) {
            logPayload.requestBody = safeSerialize(req.body);
        }

        // Add query params if present
        if (req.query && Object.keys(req.query).length > 0) {
            logPayload.queryParams = safeSerialize(req.query);
        }

        // Add path params if present
        if (req.params && Object.keys(req.params).length > 0) {
            logPayload.pathParams = safeSerialize(req.params);
        }

        // Add response body if loggable content type
        if (responseBody && isLoggableContentType(res.get('content-type'))) {
            const bodyStr = typeof responseBody === 'string'
                ? responseBody
                : JSON.stringify(responseBody);

            if (bodyStr.length <= MAX_RESPONSE_BODY_SIZE) {
                try {
                    logPayload.responseBody = JSON.parse(bodyStr);
                } catch {
                    logPayload.responseBody = truncate(bodyStr, MAX_RESPONSE_BODY_SIZE);
                }
            } else {
                logPayload.responseBody = '[body too large]';
                logPayload.responseSizeBytes = bodyStr.length;
            }
        }

        // Add auth context if available
        if (req.user) {
            logPayload.auth = {
                userId: req.user.id,
                email: req.user.email,
                role: req.user.role,
            };
        }

        // Determine log level based on status code
        const statusCode = res.statusCode;
        if (statusCode >= 500) {
            log.error(logPayload, 'Request failed (5xx)');
        } else if (statusCode >= 400) {
            log.warn(logPayload, 'Request failed (4xx)');
        } else {
            log.info(logPayload, 'Request completed');
        }
    });

    next();
};

module.exports = requestLogger;
