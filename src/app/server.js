// This file is for local development only
// On Vercel, api/index.js is used instead

const http = require('http');
const app = require('./index');
const { pool } = require('../infrastructure/config/db');
const prisma = require('../infrastructure/config/prisma');
const config = require('../infrastructure/config/env');
const logger = require('../shared/utils/logger');
const startupLogger = require('../shared/utils/startupLogger');
const redis = require('../infrastructure/config/redis');
const { startWorkers, initializeRealtime } = require('../infrastructure/bootstrap/runtime');

const server = http.createServer(app);

const io = initializeRealtime(server);

const startServer = async () => {
  try {
    // Log startup configuration
    startupLogger.logStartupConfig();

    // Verify database connection on startup (local dev only)
    const client = await pool.connect();
    client.release();
    logger.info(
      `Database connection verified @ ${config.db.host}:${config.db.port}/${config.db.name}`
    );

    await startWorkers(startupLogger);

    server.listen(config.app.port, () => {
      startupLogger.logServerListening(config.app.port, config.app.env);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  startupLogger.logShutdown(signal);

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error shutting down HTTP server');
    }
    try {
      if (io) {
        io.close();
      }
      await prisma.$disconnect();
      await pool.end();
      await redis.quit();
      logger.info('Graceful shutdown complete');
    } catch (error) {
      logger.error({ err: error }, 'Error during shutdown');
    } finally {
      process.exit(0);
    }
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ err: error, type: 'uncaughtException' }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _promise) => {
  logger.error({ err: reason, type: 'unhandledRejection' }, 'Unhandled promise rejection');
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

// Only start server if this file is run directly (not imported)
if (require.main === module) {
  startServer();
}
