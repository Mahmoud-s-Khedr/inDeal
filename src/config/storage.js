/**
 * Cloudflare R2 Storage Configuration
 * S3-compatible object storage with enhanced logging
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('./env');
const { createServiceLogger } = require('./pino');

// Create service-specific logger
const log = createServiceLogger('r2');

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
    log.warn('S3 client initialized without explicit credentials. Ensure IAM roles are available in runtime environment.');
} else {
    log.info({ bucket: config.storage.bucket, endpoint: config.storage.endpoint?.substring(0, 30) + '...' }, 'R2 storage client initialized');
}

/**
 * Upload an object to R2
 * @param {Object} params - Upload parameters
 * @param {string} params.key - Object key
 * @param {Buffer|Stream} params.body - Object content
 * @param {string} params.contentType - MIME type
 * @returns {Promise<Object>} Upload result
 */
const uploadObject = async ({ key, body, contentType, metadata = {} }) => {
    const start = Date.now();

    try {
        const command = new PutObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            Metadata: metadata,
        });

        const result = await s3Client.send(command);
        const duration = Date.now() - start;

        log.info(
            { operation: 'upload', key, contentType, durationMs: duration },
            'R2 upload completed'
        );

        return result;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'upload', key, contentType, durationMs: duration },
            'R2 upload failed'
        );
        throw err;
    }
};

/**
 * Get a signed upload URL
 * @param {Object} params - URL parameters
 * @param {string} params.key - Object key
 * @param {string} params.contentType - MIME type
 * @param {number} [params.expiresIn] - URL expiration in seconds
 * @returns {Promise<string>} Signed URL
 */
const getSignedUploadUrl = async ({ key, contentType, expiresIn = config.storage.signedUrlTtlSeconds }) => {
    const start = Date.now();

    try {
        const command = new PutObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
            ContentType: contentType,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn });
        const duration = Date.now() - start;

        log.debug(
            { operation: 'signedUrl', key, contentType, expiresIn, durationMs: duration },
            'R2 signed URL generated'
        );

        return url;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'signedUrl', key, durationMs: duration },
            'R2 signed URL generation failed'
        );
        throw err;
    }
};

/**
 * Get object metadata
 * @param {string} key - Object key
 * @returns {Promise<Object>} Object metadata
 */
const headObject = async (key) => {
    const start = Date.now();

    try {
        const command = new HeadObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        });

        const result = await s3Client.send(command);
        const duration = Date.now() - start;

        log.debug(
            { operation: 'head', key, durationMs: duration, contentLength: result.ContentLength },
            'R2 head completed'
        );

        return result;
    } catch (err) {
        const duration = Date.now() - start;
        if (err.name === 'NotFound') {
            log.debug({ operation: 'head', key, durationMs: duration }, 'R2 object not found');
        } else {
            log.error({ err, operation: 'head', key, durationMs: duration }, 'R2 head failed');
        }
        throw err;
    }
};

/**
 * Delete an object from R2
 * @param {string} key - Object key
 * @returns {Promise<Object>} Delete result
 */
const deleteObject = async (key) => {
    const start = Date.now();

    try {
        const command = new DeleteObjectCommand({
            Bucket: config.storage.bucket,
            Key: key,
        });

        const result = await s3Client.send(command);
        const duration = Date.now() - start;

        log.info(
            { operation: 'delete', key, durationMs: duration },
            'R2 delete completed'
        );

        return result;
    } catch (err) {
        const duration = Date.now() - start;
        log.error(
            { err, operation: 'delete', key, durationMs: duration },
            'R2 delete failed'
        );
        throw err;
    }
};

module.exports = {
    s3Client,
    bucket: config.storage.bucket,
    publicUrl: config.storage.publicUrl,
    uploadObject,
    getSignedUploadUrl,
    headObject,
    deleteObject,
};
