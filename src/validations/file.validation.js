const { z } = require('zod');
const { MAX_FILE_SIZE_BYTES } = require('../constants/storage');

const createUploadUrlSchema = z.object({
    body: z.object({
        fileName: z.string().min(1, 'fileName is required'),
        fileType: z.string().min(1, 'fileType is required'),
        fileSize: z
            .coerce.number()
            .int()
            .positive()
            .max(MAX_FILE_SIZE_BYTES, `fileSize cannot exceed ${MAX_FILE_SIZE_BYTES} bytes`),
    }),
});

module.exports = {
    createUploadUrlSchema,
};
