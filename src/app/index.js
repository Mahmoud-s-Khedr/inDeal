const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routing');
const { swaggerSpec, swaggerUiOptions } = require('../infrastructure/config/swagger');
const config = require('../infrastructure/config/env');
const { buildAsyncApiSpec } = require('../core/contracts/socket/registry');
const AppError = require('../core/errors/AppError');
const errorMiddleware = require('../core/middleware/errorMiddleware');
const requestLogger = require('../core/middleware/requestLogger.middleware');

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header are server-to-server or same-origin requests.
      if (!origin || config.cors.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  })
);

// Request logging (replaces Morgan with Pino-based logger)
app.use(requestLogger);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/admin-ui', express.static(path.join(__dirname, '../../admin-ui')));

const isSwaggerEnabled =
  process.env.SWAGGER_ENABLED === 'true' || process.env.NODE_ENV !== 'production';

if (isSwaggerEnabled) {
  app.get('/api/v1/docs.json', (req, res) => {
    res.json(swaggerSpec);
  });

  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  app.get('/api/v1/socket-docs.json', (req, res) => {
    res.json(buildAsyncApiSpec());
  });
}

// Root Route
app.get('/', (req, res) => {
  res.send('inDeal API is running');
});

// Backward compatibility for legacy verification links sent as /verify-email?email=...&otp=...
app.get('/verify-email', (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const target = qs ? `/api/v1/auth/verify-email?${qs}` : '/api/v1/auth/verify-email';
  res.redirect(302, target);
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
