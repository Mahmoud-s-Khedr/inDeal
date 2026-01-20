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

// Queue for notification cleanup jobs
const notificationCleanupQueue = new Queue('notification-cleanup', { connection });

// Queue for email jobs
const emailQueue = new Queue('email', { connection });

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

/**
 * Schedule recurring notification cleanup job (runs weekly).
 * Call this once on server startup.
 */
const scheduleNotificationCleanupJob = async () => {
  // Remove any existing repeatable job to avoid duplicates
  const existingJobs = await notificationCleanupQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    if (job.name === 'notification-cleanup') {
      await notificationCleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  // Schedule to run weekly on Sunday at 4:00 AM
  await notificationCleanupQueue.add(
    'notification-cleanup',
    {},
    {
      repeat: {
        pattern: '0 4 * * 0', // Cron: 4 AM every Sunday
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    }
  );

  logger.info('Scheduled notification cleanup job to run weekly on Sunday at 4 AM');
};

/**
 * Enqueue an email for async sending with retry
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.template] - Template name (e.g., 'passwordReset')
 * @param {Object} [options.variables] - Template variables
 * @param {string} [options.html] - Pre-rendered HTML (if not using template)
 * @param {string} [options.text] - Pre-rendered text (if not using template)
 * @param {number} [options.logId] - Email log ID for tracking
 * @returns {Promise<Object>} Job info
 */
const enqueueEmail = async (options) => {
  const { to, subject, template, variables, html, text, logId } = options;

  const job = await emailQueue.add(
    'send-email',
    {
      to,
      subject,
      template,
      variables,
      html,
      text,
      logId,
    },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    }
  );

  logger.debug({ jobId: job.id, to, template, logId }, 'Email job enqueued');
  return { jobId: job.id };
};

module.exports = {
  fileCleanupQueue,
  imageOptimizationQueue,
  notificationCleanupQueue,
  emailQueue,
  scheduleCleanupJob,
  scheduleNotificationCleanupJob,
  enqueueImageOptimization,
  enqueueEmail,
  connection,
};
