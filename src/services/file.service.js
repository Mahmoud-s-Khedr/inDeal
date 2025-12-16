const crypto = require('crypto');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const AppError = require('../utils/AppError');
const fileRepository = require('../repositories/file.repository');
const { s3Client, bucket, publicUrl } = require('../config/storage');
const { MAX_FILE_SIZE_BYTES, SIGNED_URL_TTL_SECONDS } = require('../constants/storage');

const buildPublicUrl = (filePath) => {
    if (!publicUrl || !filePath) return null;
    return `${publicUrl.replace(/\/$/, '')}/${filePath}`;
};

const sanitizeFile = (file) => {
    if (!file) return null;
    return {
        id: file.id,
        fileName: file.fileName,
        filePath: file.filePath,
        fileMetadata: file.fileMetadata,
        uploadedAt: file.uploadedAt,
        publicUrl: buildPublicUrl(file.filePath),
    };
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
        throw new AppError(`File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES} bytes`, 400);
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
