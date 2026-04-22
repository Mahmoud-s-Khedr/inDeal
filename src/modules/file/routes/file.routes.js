const express = require('express');
const validate = require('../../../core/middleware/validateMiddleware');
const fileController = require('../controller/file.controller');
const { createUploadUrlSchema, getFileSchema } = require('../validation/file.validation');
const protect = require('../../../core/middleware/authMiddleware');

const router = express.Router();

// Protected route - generate signed upload URL (more specific, must come first)
router.post(
  '/upload-url',
  protect,
  validate(createUploadUrlSchema),
  fileController.createUploadUrl
);

// Public route - get file by ID (generic parameter route, comes last)
router.get('/:id', validate(getFileSchema), fileController.getFileById);

module.exports = router;
