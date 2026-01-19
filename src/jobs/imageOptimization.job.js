const { Worker } = require('bullmq');
const sharp = require('sharp');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { connection } = require('../config/jobQueue');
const { s3Client, bucket, publicUrl } = require('../config/storage');
const fileRepository = require('../repositories/file.repository');
const config = require('../config/env');
const logger = require('../utils/logger');

// Image optimization configuration
const IMAGE_THUMB_SIZE = config.imageOptimization?.thumbSize || 150;
const IMAGE_MEDIUM_SIZE = config.imageOptimization?.mediumSize || 600;
const IMAGE_QUALITY = config.imageOptimization?.quality || 85;

// Supported image types for optimization
const OPTIMIZABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Generate variant key from original key.
 * Example: uploads/2026-01-06/image-abc.jpg → uploads/2026-01-06/image-abc_thumb.webp
 */
const getVariantKey = (originalKey, variant) => {
  const lastDot = originalKey.lastIndexOf('.');
  const basePath = lastDot > 0 ? originalKey.substring(0, lastDot) : originalKey;
  return `${basePath}_${variant}.webp`;
};

/**
 * Download file from R2 as buffer.
 */
const downloadFromR2 = async (key) => {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  // Stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Upload buffer to R2.
 */
const uploadToR2 = async (key, buffer, contentType = 'image/webp') => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
};

/**
 * Process a single image optimization job.
 */
const processImageOptimization = async (job) => {
  const { fileId, filePath, mimeType } = job.data;

  if (!filePath) {
    logger.warn(`Image optimization job ${job.id}: missing filePath`);
    return { skipped: true, reason: 'missing filePath' };
  }

  if (!OPTIMIZABLE_TYPES.includes(mimeType)) {
    logger.debug(`Skipping non-optimizable file type: ${mimeType}`);
    return { skipped: true, reason: 'non-optimizable type' };
  }

  logger.info(`Optimizing image ${fileId}: ${filePath}`);

  try {
    // Download original
    const originalBuffer = await downloadFromR2(filePath);

    // Generate thumbnail
    const thumbKey = getVariantKey(filePath, 'thumb');
    const thumbBuffer = await sharp(originalBuffer)
      .resize(IMAGE_THUMB_SIZE, IMAGE_THUMB_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: IMAGE_QUALITY - 5 }) // Slightly lower for thumb
      .toBuffer();

    // Generate medium
    const mediumKey = getVariantKey(filePath, 'medium');
    const mediumBuffer = await sharp(originalBuffer)
      .resize(IMAGE_MEDIUM_SIZE, null, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_QUALITY })
      .toBuffer();

    // Upload variants
    await Promise.all([uploadToR2(thumbKey, thumbBuffer), uploadToR2(mediumKey, mediumBuffer)]);

    // Update file metadata with variant paths
    const variants = {
      thumb: thumbKey,
      medium: mediumKey,
    };

    if (publicUrl) {
      const baseUrl = publicUrl.replace(/\/$/, '');
      variants.thumbUrl = `${baseUrl}/${thumbKey}`;
      variants.mediumUrl = `${baseUrl}/${mediumKey}`;
    }

    await fileRepository.updateMetadata(fileId, { variants });

    logger.info(`Image ${fileId} optimized: ${thumbKey}, ${mediumKey}`);

    return { success: true, variants };
  } catch (error) {
    logger.error(`Failed to optimize image ${fileId}`, error);
    throw error; // Will be retried by BullMQ
  }
};

/**
 * Create and start the image optimization worker.
 */
const startImageOptimizationWorker = () => {
  const worker = new Worker('image-optimization', processImageOptimization, {
    connection,
    concurrency: 2, // Process 2 images at a time
  });

  worker.on('completed', (job, result) => {
    if (!result.skipped) {
      logger.debug(`Image optimization job ${job.id} completed`);
    }
  });

  worker.on('failed', (job, error) => {
    logger.error(`Image optimization job ${job?.id} failed`, error);
  });

  logger.info('Image optimization worker started');

  return worker;
};

module.exports = {
  startImageOptimizationWorker,
  getVariantKey,
};
