const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const errorMiddleware = require('./middlewares/errorMiddleware');
const requestLogger = require('./middlewares/requestLogger.middleware');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());

// Request logging (replaces Morgan with Pino-based logger)
app.use(requestLogger);

// Body parsing
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
