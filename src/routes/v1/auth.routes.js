const express = require('express');
const validate = require('../../middlewares/validateMiddleware');
const authController = require('../../controllers/auth.controller');
const protect = require('../../middlewares/authMiddleware');
const {
  registerSchema,
  resubmitSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} = require('../../validations/auth.validation');
const { createUploadUrlSchema } = require('../../validations/file.validation');

const router = express.Router();

router.post(
  '/register/upload-url',
  validate(createUploadUrlSchema),
  authController.createRegistrationUploadUrl
);
router.post('/register', validate(registerSchema), authController.register);
router.post('/resubmit', protect, validate(resubmitSchema), authController.resubmit);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', protect, authController.logout);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post(
  '/resend-forgot-password-otp',
  validate(forgotPasswordSchema),
  authController.resendForgotPasswordOtp
);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
