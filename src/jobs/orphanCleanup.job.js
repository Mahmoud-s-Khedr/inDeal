const { Worker } = require('bullmq');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { connection } = require('../config/jobQueue');
const { s3Client, bucket } = require('../config/storage');
const fileRepository = require('../repositories/file.repository');
const config = require('../config/env');
const logger = require('../utils/logger');

// Default retention: 7 days (in seconds)
const FILE_RETENTION_SECONDS = config.fileRetentionSeconds || 7 * 24 * 60 * 60;

/**
 * Delete a file from R2 storage.
 */
const deleteFromR2 = async (filePath) => {
    if (!bucket || !filePath) {
        logger.warn('Cannot delete from R2: missing bucket or filePath');
        return false;
    }

    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: bucket,
                Key: filePath,
            })
        );
        return true;
    } catch (error) {
        logger.error(`Failed to delete file from R2: ${filePath}`, error);
        return false;
    }
};

/**
 * Process orphan cleanup job.
 * Finds files soft-deleted beyond retention period, removes from R2, then hard deletes.
 */
const processCleanupJob = async (job) => {
    logger.info('Starting orphan cleanup job');

    const orphanedFiles = await fileRepository.findOrphanedFiles(FILE_RETENTION_SECONDS, 100);

    if (!orphanedFiles.length) {
        logger.info('No orphaned files to clean up');
        return { cleaned: 0 };
    }

    logger.info(`Found ${orphanedFiles.length} files to clean up`);

    let successCount = 0;
    let failCount = 0;

    for (const file of orphanedFiles) {
        try {
            // Step 1: Delete from R2
            const r2Deleted = await deleteFromR2(file.filePath);

            if (r2Deleted) {
                // Step 2: Hard delete from database
                await fileRepository.hardDelete(file.id);
                successCount += 1;
                logger.debug(`Cleaned up file ${file.id}: ${file.filePath}`);
            } else {
                // If R2 deletion failed, we'll retry on next run
                failCount += 1;
            }
        } catch (error) {
            logger.error(`Error cleaning up file ${file.id}`, error);
            failCount += 1;
        }
    }

    logger.info(`Orphan cleanup complete: ${successCount} cleaned, ${failCount} failed`);

    return { cleaned: successCount, failed: failCount };
};

/**
 * Create and start the orphan cleanup worker.
 */
const startOrphanCleanupWorker = () => {
    const worker = new Worker('file-cleanup', processCleanupJob, {
        connection,
        concurrency: 1,
    });

    worker.on('completed', (job, result) => {
        logger.info(`Cleanup job ${job.id} completed`, result);
    });

    worker.on('failed', (job, error) => {
        logger.error(`Cleanup job ${job?.id} failed`, error);
    });

    logger.info('Orphan cleanup worker started');

    return worker;
};

module.exports = {
    startOrphanCleanupWorker,
    deleteFromR2,
};
