const { Worker } = require('bullmq');
const { connection } = require('../config/jobQueue');
const notificationRepository = require('../repositories/notification.repository');
const config = require('../config/env');
const logger = require('../utils/logger');

// Default retention: 90 days for read, 180 days for unread
const READ_RETENTION_DAYS = config.notificationRetentionReadDays || 90;
const UNREAD_RETENTION_DAYS = config.notificationRetentionUnreadDays || 180;

/**
 * Process notification cleanup job.
 * Deletes old notifications based on retention policy:
 * - Read notifications older than READ_RETENTION_DAYS
 * - Unread notifications older than UNREAD_RETENTION_DAYS
 */
const processCleanupJob = async (_job) => {
    logger.info('Starting notification cleanup job', {
        readRetentionDays: READ_RETENTION_DAYS,
        unreadRetentionDays: UNREAD_RETENTION_DAYS,
    });

    try {
        const result = await notificationRepository.deleteOlderThan(
            READ_RETENTION_DAYS,
            UNREAD_RETENTION_DAYS
        );

        logger.info('Notification cleanup complete', {
            readDeleted: result.readDeleted,
            unreadDeleted: result.unreadDeleted,
        });

        return result;
    } catch (error) {
        logger.error({ err: error }, 'Notification cleanup job failed');
        throw error;
    }
};

/**
 * Create and start the notification cleanup worker.
 */
const startNotificationCleanupWorker = () => {
    const worker = new Worker('notification-cleanup', processCleanupJob, {
        connection,
        concurrency: 1,
    });

    worker.on('completed', (job, result) => {
        logger.info(`Notification cleanup job ${job.id} completed`, result);
    });

    worker.on('failed', (job, error) => {
        logger.error(`Notification cleanup job ${job?.id} failed`, error);
    });

    logger.info('Notification cleanup worker started');

    return worker;
};

module.exports = {
    startNotificationCleanupWorker,
    processCleanupJob,
};
