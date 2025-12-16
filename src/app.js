const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const errorMiddleware = require('./middlewares/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
const safeData = (value) => {
    if (value === undefined || value === null) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return '[unserializable]';
    }
};

const safeHeaders = (headers) => {
    if (!headers) return undefined;
    try {
        return JSON.parse(JSON.stringify(headers));
    } catch (error) {
        return '[unserializable headers]';
    }
};

app.use(
    morgan((tokens, req, res) => {
        const responseTime = tokens['response-time'](req, res);
        const contentLength = tokens.res(req, res, 'content-length') || 0;

        const logPayload = {
            method: tokens.method(req, res),
            url: tokens.url(req, res),
            status: Number(tokens.status(req, res)),
            responseTimeMs: Number(responseTime),
            length: Number(contentLength),
            ip: req.ip,
            userAgent: req.get('user-agent'),
            requestHeaders: safeHeaders(req.headers),
            requestParams: safeData(req.params),
            requestQuery: safeData(req.query),
            requestBody: safeData(req.body),
        };

        const responseData = res.locals.responseData;
        if (responseData !== undefined) {
            logPayload.responseBody = safeData(responseData);
        }

        if (res.getHeaders) {
            logPayload.responseHeaders = safeHeaders(res.getHeaders());
        }

        if (req.user) {
            logPayload.auth = {
                id: req.user.id,
                email: req.user.email,
                role: req.user.role,
            };
        }

        logger.http('HTTP request', logPayload);

        return null;
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Route
app.get('/', (req, res) => {
    res.send('inDeal API is running');
});

// API Routes
app.use('/api', routes);

// 404 Handler
app.use((req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

// Global Error Handler
app.use(errorMiddleware);

module.exports = app;
