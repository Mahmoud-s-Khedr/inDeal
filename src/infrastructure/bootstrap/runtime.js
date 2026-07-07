const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('../../shared/utils/logger');
const redis = require('../config/redis');
const { scheduleCleanupJob } = require('../config/jobQueue');
const { startOrphanCleanupWorker } = require('../jobs/orphanCleanup.job');
const { startImageOptimizationWorker } = require('../jobs/imageOptimization.job');
const { startEmailWorker } = require('../jobs/email.job');
const { initializeChatSockets } = require('../sockets/chat.handler');
const socketService = require('../socket.service');

// Eager-load infrastructure modules so configuration issues surface on boot
require('../config/storage');
require('../config/mailer');
require('../config/queue');

const startWorkers = async (startupLogger) => {
  const workers = [];

  workers.push(startOrphanCleanupWorker());
  startupLogger.logWorkerStarted('orphan-cleanup');

  workers.push(startImageOptimizationWorker());
  startupLogger.logWorkerStarted('image-optimization');

  workers.push(startEmailWorker());
  startupLogger.logWorkerStarted('email');

  await scheduleCleanupJob();

  return workers;
};

const initializeRealtime = (server) => {
  if (process.env.ENABLE_SOCKETIO !== 'true') {
    logger.info(
      { feature: 'socketio', enabled: false },
      'Socket.io disabled (set ENABLE_SOCKETIO=true to enable)'
    );
    return null;
  }

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

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

  initializeChatSockets(io);
  socketService.init(io);
  logger.info({ feature: 'socketio', enabled: true }, 'Socket.io enabled');

  return io;
};

module.exports = {
  startWorkers,
  initializeRealtime,
};
