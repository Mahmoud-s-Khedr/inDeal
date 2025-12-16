const express = require('express');
const validate = require('../../middlewares/validateMiddleware');
const fileController = require('../../controllers/file.controller');
const { createUploadUrlSchema } = require('../../validations/file.validation');
const protect = require('../../middlewares/authMiddleware');

const router = express.Router();

router.post('/upload-url', protect, validate(createUploadUrlSchema), fileController.createUploadUrl);

module.exports = router;
