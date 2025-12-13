const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { app: appConfig } = require('../config/env');

const handleCastErrorDB = err => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
    // Regex to match "Key (email)=(...)" in Postgres error
    const value = err.detail.match(/\(([^)]+)\)/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    return new AppError(message, 400);
};

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    } else {
        // Programming or other unknown error: don't leak details
        logger.error('Unexpected error', err);
        res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!'
        });
    }
};

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (appConfig.env === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        // Handle specific DB errors (Postgres)
        if (error.code === '23505') error = handleDuplicateFieldsDB(error); // Unique violation
        if (error.code === '22P02') error = handleCastErrorDB(error);       // Invalid input syntax

        sendErrorProd(error, res);
    }
};
