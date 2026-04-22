const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const { swaggerSpec, swaggerUiOptions } = require('./config/swagger');
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

const isSwaggerEnabled =
  process.env.SWAGGER_ENABLED === 'true' || process.env.NODE_ENV !== 'production';

if (isSwaggerEnabled) {
  app.get('/api/v1/docs.json', (req, res) => {
    res.json(swaggerSpec);
  });

  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

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
