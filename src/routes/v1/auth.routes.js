const express = require('express');
const validate = require('../../middlewares/validateMiddleware');
const authController = require('../../controllers/auth.controller');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyOtpSchema, verifyEmailSchema } = require('../../validations/auth.validation');
const { createUploadUrlSchema } = require('../../validations/file.validation');

const router = express.Router();

router.post('/register/upload-url', validate(createUploadUrlSchema), authController.createRegistrationUploadUrl);
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/admin/login', validate(loginSchema), authController.adminLogin);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.get('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);

module.exports = router;
