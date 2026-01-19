// This file is for local development only
// On Vercel, api/index.js is used instead

const http = require('http');
const app = require('./app');
const { pool } = require('./config/db');
const config = require('./config/env');
const logger = require('./utils/logger');
const startupLogger = require('./utils/startupLogger');
const redis = require('./config/redis');

// Eager-load infrastructure modules so configuration issues surface on boot
require('./config/firebase');
require('./config/storage');
require('./config/mailer');
require('./config/queue');

// Job queues and workers
const { scheduleCleanupJob } = require('./config/jobQueue');
const { startOrphanCleanupWorker } = require('./jobs/orphanCleanup.job');
const { startImageOptimizationWorker } = require('./jobs/imageOptimization.job');

const server = http.createServer(app);

// Socket.io is disabled for Vercel deployment
// For real-time features, use a separate WebSocket service (Pusher, Ably, etc.)
// or deploy WebSocket server to Railway/Render
const ENABLE_SOCKETIO = process.env.ENABLE_SOCKETIO === 'true';

let io = null;

if (ENABLE_SOCKETIO) {
  const { Server } = require('socket.io');
  const { initializeChatSockets } = require('./sockets/chat.handler');
  const { createAdapter } = require('@socket.io/redis-adapter');

  io = new Server(server, {
    cors: {
      origin: '*', // Configure allowed origins before production
      methods: ['GET', 'POST'],
    },
  });

  // Set up Redis adapter for horizontal scaling (optional, based on Redis availability)
  const useRedisAdapter = process.env.ENABLE_REDIS_ADAPTER === 'true';
  if (useRedisAdapter && redis) {
    try {
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info({ feature: 'socketio-redis' }, 'Socket.io Redis adapter enabled');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to set up Redis adapter, continuing without it');
    }
  }

  // Initialize chat handlers
  initializeChatSockets(io);

  // Initialize general socket service
  require('./services/socket.service').init(io);

  logger.info({ feature: 'socketio', enabled: true }, 'Socket.io enabled');
} else {
  logger.info(
    { feature: 'socketio', enabled: false },
    'Socket.io disabled (set ENABLE_SOCKETIO=true to enable)'
  );
}

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

    // Start background job workers
    startOrphanCleanupWorker();
    startupLogger.logWorkerStarted('orphan-cleanup');

    startImageOptimizationWorker();
    startupLogger.logWorkerStarted('image-optimization');

    await scheduleCleanupJob();

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
