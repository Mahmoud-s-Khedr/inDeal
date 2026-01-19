const crypto = require('crypto');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const AppError = require('../utils/AppError');
const fileRepository = require('../repositories/file.repository');
const { s3Client, bucket, publicUrl } = require('../config/storage');
const { MAX_FILE_SIZE_BYTES, SIGNED_URL_TTL_SECONDS } = require('../constants/storage');
const { enqueueImageOptimization } = require('../config/jobQueue');

// Image types that can be optimized
const OPTIMIZABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const buildPublicUrl = (filePath) => {
  if (!publicUrl || !filePath) return null;
  return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const sanitizeFile = (file) => {
  if (!file) return null;
  const result = {
    id: file.id,
    fileName: file.fileName,
    filePath: file.filePath,
    fileMetadata: file.fileMetadata,
    uploadedAt: file.uploadedAt,
    publicUrl: buildPublicUrl(file.filePath),
  };

  // Add variant URLs if available
  if (file.fileMetadata?.variants) {
    const variants = file.fileMetadata.variants;
    result.thumbnailUrl = variants.thumbUrl || buildPublicUrl(variants.thumb);
    result.mediumUrl = variants.mediumUrl || buildPublicUrl(variants.medium);
  }

  return result;
};

const generateFileKey = (originalName) => {
  const ext = path.extname(originalName || '').toLowerCase();
  const baseName = path
    .basename(originalName || 'file', ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  const safeBase = baseName || 'file';
  const datePrefix = new Date().toISOString().split('T')[0];
  const uniqueSuffix = crypto.randomUUID();
  return `uploads/${datePrefix}/${safeBase}-${uniqueSuffix}${ext}`;
};

const createUploadUrl = async ({ fileName, fileType, fileSize, uploaderId }) => {
  if (!bucket) {
    throw new AppError('Storage bucket is not configured', 500);
  }
  if (!fileName) {
    throw new AppError('fileName is required', 400);
  }
  if (!fileType) {
    throw new AppError('fileType is required', 400);
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new AppError('fileSize must be a positive number', 400);
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes`,
      400
    );
  }

  const objectKey = generateFileKey(fileName);
  const fileMetadata = {
    originalFileName: fileName,
    mimeType: fileType,
    size: fileSize,
    uploaderId: uploaderId || null,
  };

  const fileRecord = await fileRepository.createFile({
    fileName,
    filePath: objectKey,
    fileMetadata,
  });

  const metadata = {};
  if (uploaderId) {
    metadata.uploaderId = String(uploaderId);
  }

  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: fileType,
    ...(Object.keys(metadata).length ? { Metadata: metadata } : {}),
  });

  const url = await getSignedUrl(s3Client, putCommand, {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });

  // Enqueue image optimization if this is an optimizable image type
  if (OPTIMIZABLE_IMAGE_TYPES.includes(fileType)) {
    await enqueueImageOptimization(fileRecord.id, objectKey, fileType);
  }

  return {
    file: sanitizeFile(fileRecord),
    upload: {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': fileType,
      },
      expiresIn: SIGNED_URL_TTL_SECONDS,
    },
  };
};

module.exports = {
  createUploadUrl,
};
