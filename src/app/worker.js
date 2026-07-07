const { pool } = require('../infrastructure/config/db');
const prisma = require('../infrastructure/config/prisma');
const config = require('../infrastructure/config/env');
const logger = require('../shared/utils/logger');
const startupLogger = require('../shared/utils/startupLogger');
const redis = require('../infrastructure/config/redis');
const { startWorkers } = require('../infrastructure/bootstrap/runtime');

let workers = [];

const startWorkerRuntime = async () => {
  try {
    startupLogger.logStartupConfig();

    const client = await pool.connect();
    client.release();
    logger.info(
      `Database connection verified @ ${config.db.host}:${config.db.port}/${config.db.name}`
    );

    workers = await startWorkers(startupLogger);
    logger.info({ workerCount: workers.length }, 'Worker runtime ready');
  } catch (error) {
    logger.error({ err: error }, 'Failed to start worker runtime');
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  startupLogger.logShutdown(signal);

  try {
    await Promise.allSettled(workers.map((worker) => worker?.close?.()));
    await prisma.$disconnect();
    await pool.end();
    await redis.quit();
    logger.info('Worker shutdown complete');
  } catch (error) {
    logger.error({ err: error }, 'Error during worker shutdown');
  } finally {
    process.exit(0);
  }
};

process.on('uncaughtException', (error) => {
  logger.error({ err: error, type: 'uncaughtException' }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error({ err: reason, type: 'unhandledRejection' }, 'Unhandled promise rejection');
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

if (require.main === module) {
  startWorkerRuntime();
}

module.exports = {
  startWorkerRuntime,
};
