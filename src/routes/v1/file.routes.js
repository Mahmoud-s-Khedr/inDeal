const express = require('express');
const validate = require('../../middlewares/validateMiddleware');
const fileController = require('../../controllers/file.controller');
const { createUploadUrlSchema, getFileSchema } = require('../../validations/file.validation');
const protect = require('../../middlewares/authMiddleware');

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
