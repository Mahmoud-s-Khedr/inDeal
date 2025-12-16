const express = require('express');
const validate = require('../../middlewares/validateMiddleware');
const authController = require('../../controllers/auth.controller');
const { registerSchema, loginSchema } = require('../../validations/auth.validation');
const { createUploadUrlSchema } = require('../../validations/file.validation');

const router = express.Router();

router.post('/register/upload-url', validate(createUploadUrlSchema), authController.createRegistrationUploadUrl);
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/admin/login', validate(loginSchema), authController.adminLogin);

module.exports = router;
