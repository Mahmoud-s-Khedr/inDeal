const { Queue } = require('bullmq');
const logger = require('../utils/logger');
const config = require('./env');

// Shared connection options using existing Redis client config
const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  username: config.redis.username,
};

// Queue for file cleanup jobs
const fileCleanupQueue = new Queue('file-cleanup', { connection });

// Queue for image optimization jobs
const imageOptimizationQueue = new Queue('image-optimization', { connection });

/**
 * Schedule recurring cleanup job (runs daily).
 * Call this once on server startup.
 */
const scheduleCleanupJob = async () => {
  // Remove any existing repeatable job to avoid duplicates
  const existingJobs = await fileCleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'orphan-cleanup') {
      await fileCleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule to run daily at 3:00 AM
  await fileCleanupQueue.add(
    'orphan-cleanup',
    {},
    {
      repeat: {
        pattern: '0 3 * * *', // Cron: 3 AM every day
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    }
  );

  logger.info('Scheduled orphan cleanup job to run daily at 3 AM');
};

/**
 * Add a single image optimization job.
 * @param {number} fileId - The file ID to optimize
 * @param {string} filePath - The R2 object key
 * @param {string} mimeType - The file MIME type
 */
const enqueueImageOptimization = async (fileId, filePath, mimeType) => {
  await imageOptimizationQueue.add(
    'optimize-image',
    { fileId, filePath, mimeType },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    }
  );
  logger.debug(`Enqueued image optimization job for file ${fileId}`);
};

module.exports = {
  fileCleanupQueue,
  imageOptimizationQueue,
  scheduleCleanupJob,
  enqueueImageOptimization,
  connection,
};
