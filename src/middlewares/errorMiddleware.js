/**
 * Error Middleware
 *
 * Enhanced global error handler with:
 * - Detailed error logging with context
 * - Error categorization
 * - Request context in logs
 * - Stack traces in development
 */

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { app: appConfig } = require('../config/env');

/**
 * Error categories for classification
 */
const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  DATABASE: 'database',
  EXTERNAL_SERVICE: 'external_service',
  RATE_LIMIT: 'rate_limit',
  INTERNAL: 'internal',
};

/**
 * Categorize error based on status code and type
 */
const categorizeError = (err) => {
  // Database errors
  if (err.code && err.code.startsWith('2')) {
    return ERROR_CATEGORIES.DATABASE;
  }

  // Status code based categorization
  switch (err.statusCode) {
    case 400:
      return ERROR_CATEGORIES.VALIDATION;
    case 401:
      return ERROR_CATEGORIES.AUTHENTICATION;
    case 403:
      return ERROR_CATEGORIES.AUTHORIZATION;
    case 404:
      return ERROR_CATEGORIES.NOT_FOUND;
    case 429:
      return ERROR_CATEGORIES.RATE_LIMIT;
    default:
      return err.statusCode >= 500 ? ERROR_CATEGORIES.INTERNAL : ERROR_CATEGORIES.VALIDATION;
  }
};

/**
 * Extract source location from error stack
 */
const extractSourceLocation = (stack) => {
  if (!stack) return null;

  const lines = stack.split('\n');
  // Find first line that's not from node_modules and contains a file path
  for (const line of lines.slice(1)) {
    if (!line.includes('node_modules') && line.includes('/')) {
      const match = line.match(/at .+ \((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
        };
      }
    }
  }
  return null;
};

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  // Regex to match "Key (email)=(...)" in Postgres error
  const match = err.detail?.match(/\(([^)]+)\)/);
  const value = match ? match[0] : 'unknown';
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

/**
 * Build error log payload with full context
 */
const buildErrorLogPayload = (err, req) => {
  const payload = {
    err: {
      type: err.constructor.name,
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      isOperational: err.isOperational,
    },
    category: categorizeError(err),
    request: {
      method: req.method,
      url: req.originalUrl || req.url,
      requestId: req.requestId,
    },
  };

  // Add source location in development
  if (appConfig.env === 'development' || !err.isOperational) {
    const source = extractSourceLocation(err.stack);
    if (source) {
      payload.source = source;
    }
    payload.err.stack = err.stack;
  }

  // Add user context if available
  if (req.user) {
    payload.user = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };
  }

  return payload;
};

const sendErrorDev = (err, req, res) => {
  const payload = {
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  };
  res.locals.responseData = payload;
  res.status(err.statusCode).json(payload);
};

const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const payload = {
      status: err.status,
      message: err.message,
    };
    res.locals.responseData = payload;
    res.status(err.statusCode).json(payload);
  } else {
    // Programming or other unknown error: don't leak details
    // Log the full error for debugging
    logger.error(buildErrorLogPayload(err, req), 'Unexpected server error');

    const payload = {
      status: 'error',
      message: 'Something went very wrong!',
    };
    res.locals.responseData = payload;
    res.status(500).json(payload);
  }
};

module.exports = (err, req, res, _next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors with context
  const logPayload = buildErrorLogPayload(err, req);

  if (err.statusCode >= 500) {
    logger.error(logPayload, 'Server error occurred');
  } else if (err.statusCode >= 400) {
    logger.warn(logPayload, 'Client error occurred');
  }

  if (appConfig.env === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.stack = err.stack;

    // Handle specific DB errors (Postgres)
    if (error.code === '23505') error = handleDuplicateFieldsDB(error); // Unique violation
    if (error.code === '22P02') error = handleCastErrorDB(error); // Invalid input syntax

    sendErrorProd(error, req, res);
  }
};
