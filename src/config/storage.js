const { S3Client } = require('@aws-sdk/client-s3');
const config = require('./env');
const logger = require('../utils/logger');

const hasCredentials = config.storage.accessKeyId && config.storage.secretAccessKey;

const s3Client = new S3Client({
    region: config.storage.region,
    endpoint: config.storage.endpoint || undefined,
    forcePathStyle: true,
    credentials: hasCredentials
        ? {
              accessKeyId: config.storage.accessKeyId,
              secretAccessKey: config.storage.secretAccessKey,
          }
        : undefined,
});

if (!hasCredentials) {
    logger.warn('S3 client initialized without explicit credentials. Ensure IAM roles are available in runtime environment.');
}

module.exports = {
    s3Client,
    bucket: config.storage.bucket,
    publicUrl: config.storage.publicUrl,
};
