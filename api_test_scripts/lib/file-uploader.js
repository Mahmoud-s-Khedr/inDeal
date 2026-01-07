/**
 * File Uploader - Helper for R2 signed URL uploads
 */

import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample test files (small placeholder files for testing)
const SAMPLE_FILES = {
    image: {
        path: join(__dirname, '../assets/sample-image.jpg'),
        type: 'image/jpeg',
        fallbackSize: 1024, // 1KB placeholder
    },
    document: {
        path: join(__dirname, '../assets/sample-document.pdf'),
        type: 'application/pdf',
        fallbackSize: 2048, // 2KB placeholder
    },
    video: {
        path: join(__dirname, '../assets/sample-video.mp4'),
        type: 'video/mp4',
        fallbackSize: 4096, // 4KB placeholder
    },
};

/**
 * Upload a file to R2 using a signed URL
 * @param {string} signedUrl - The pre-signed PUT URL
 * @param {Buffer|string} content - File content or path to file
 * @param {string} contentType - MIME type of the file
 * @param {object} headers - Additional headers from the upload response
 */
export async function uploadToR2(signedUrl, content, contentType, headers = {}) {
    let fileContent = content;

    // If content is a file path, read it
    if (typeof content === 'string' && existsSync(content)) {
        fileContent = readFileSync(content);
    }

    try {
        const response = await axios.put(signedUrl, fileContent, {
            headers: {
                'Content-Type': contentType,
                ...headers,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        console.log(chalk.green(`  ✓ File uploaded successfully`));
        return response;
    } catch (error) {
        console.log(chalk.red(`  ✗ Upload failed: ${error.message}`));
        throw error;
    }
}

/**
 * Create a placeholder file buffer for testing
 * This creates a minimal valid file-like content
 */
export function createPlaceholderFile(type = 'image', sizeBytes = 1024) {
    // For simplicity, we'll create a buffer with random data
    // In a real scenario, you might want to use actual minimal valid files
    const buffer = Buffer.alloc(sizeBytes);

    // Add some "magic bytes" to make it look like the right file type
    switch (type) {
        case 'image':
        case 'jpeg':
            // JPEG magic bytes
            buffer[0] = 0xFF;
            buffer[1] = 0xD8;
            buffer[2] = 0xFF;
            break;
        case 'png':
            // PNG magic bytes
            buffer[0] = 0x89;
            buffer[1] = 0x50;
            buffer[2] = 0x4E;
            buffer[3] = 0x47;
            break;
        case 'pdf':
        case 'document':
            // PDF magic bytes
            buffer.write('%PDF-1.4', 0);
            break;
        case 'video':
        case 'mp4':
            // MP4 magic bytes (ftyp)
            buffer.write('ftyp', 4);
            break;
        default:
            // Random content
            for (let i = 0; i < sizeBytes; i++) {
                buffer[i] = Math.floor(Math.random() * 256);
            }
    }

    return buffer;
}

/**
 * Get sample file for testing
 * Returns real file if available, otherwise creates placeholder
 */
export function getSampleFile(type = 'image') {
    const sample = SAMPLE_FILES[type] || SAMPLE_FILES.image;

    if (existsSync(sample.path)) {
        return {
            content: readFileSync(sample.path),
            type: sample.type,
            name: `sample-${type}.${sample.type.split('/')[1]}`,
        };
    }

    // Create placeholder
    return {
        content: createPlaceholderFile(type, sample.fallbackSize),
        type: sample.type,
        name: `test-${type}-${Date.now()}.${sample.type.split('/')[1]}`,
    };
}

/**
 * Upload workflow: Get signed URL and upload file
 * @param {object} apiClient - The API client instance
 * @param {string} type - 'image', 'document', or 'video'
 * @param {boolean} isRegistration - Whether this is for registration (uses different endpoint)
 */
export async function uploadFile(apiClient, type = 'image', isRegistration = false) {
    const sample = getSampleFile(type);

    console.log(chalk.gray(`  Getting upload URL for ${sample.name}...`));

    // Get signed URL
    const urlResponse = isRegistration
        ? await apiClient.getRegisterUploadUrl(sample.name, sample.type, sample.content.length)
        : await apiClient.getUploadUrl(sample.name, sample.type, sample.content.length);

    const { file, upload } = urlResponse.data;

    console.log(chalk.gray(`  Uploading to R2...`));

    // Upload to R2
    await uploadToR2(upload.url, sample.content, sample.type, upload.headers || {});

    return {
        fileId: file.id,
        fileName: file.fileName,
        filePath: file.filePath,
        publicUrl: file.publicUrl,
    };
}

export default {
    uploadToR2,
    createPlaceholderFile,
    getSampleFile,
    uploadFile,
};
