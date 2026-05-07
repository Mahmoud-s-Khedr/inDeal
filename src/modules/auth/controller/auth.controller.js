const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const authService = require('../service/auth.service');
const config = require('../../../infrastructure/config/env');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderVerificationHtml = ({ success, title, message }) => {
  const statusColor = success ? '#198754' : '#dc3545';
  const icon = success ? '✓' : '!';
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const homeUrl = `${config.forgotPassword.frontendUrl.replace(/\/$/, '')}/`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f8fb; color: #1f2937; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 520px; background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); padding: 28px; text-align: center; }
    .badge { width: 56px; height: 56px; border-radius: 999px; margin: 0 auto 16px; background: ${statusColor}; color: #fff; font-size: 32px; line-height: 56px; font-weight: 700; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0 0 22px; color: #4b5563; line-height: 1.6; }
    a { display: inline-block; background: #0d6efd; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">${icon}</div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <a href="${homeUrl}">Open inDeal</a>
    </div>
  </div>
</body>
</html>`;
};

const createRegistrationUploadUrl = catchAsync(async (req, res) => {
  const signedUpload = await authService.createRegistrationUploadUrl(req.body);
  sendResponse(res, 201, signedUpload, 'Signed upload URL generated');
});

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendResponse(res, 201, result, 'Registration submitted successfully');
});

const resubmit = catchAsync(async (req, res) => {
  const result = await authService.resubmit(req.user.id, req.body);
  sendResponse(res, 200, result, 'Company resubmitted successfully');
});

const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendResponse(res, 200, result, 'Login successful');
});

const logout = catchAsync(async (req, res) => {
  const result = await authService.logoutAllSessions(req.user.id);
  delete res.locals.accessToken;
  sendResponse(res, 200, result, result.message);
});

const forgotPassword = catchAsync(async (req, res) => {
  const result = await authService.forgotPassword({
    email: req.body.email,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  const payload = result || { message: 'If the email exists, instructions were sent.' };
  sendResponse(res, 200, payload, payload.message);
});

const resendForgotPasswordOtp = catchAsync(async (req, res) => {
  const result = await authService.resendForgotPasswordOtp({
    email: req.body.email,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendResponse(res, 200, result, result.message);
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword({
    email: req.body.email,
    otp: req.body.otp,
    password: req.body.password,
    ipAddress: req.ip,
  });
  const payload = { message: 'Password updated successfully.' };
  sendResponse(res, 200, payload, payload.message);
});

const verifyOtp = catchAsync(async (req, res) => {
  const result = await authService.verifyOtp({
    email: req.body.email,
    otp: req.body.otp,
    ipAddress: req.ip,
  });
  sendResponse(res, 200, result, result.message);
});

const resendVerification = catchAsync(async (req, res) => {
  const result = await authService.resendVerification({
    email: req.body.email,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  sendResponse(res, 200, result, result.message);
});

const verifyEmail = catchAsync(async (req, res) => {
  const result = await authService.verifyEmail({
    email: req.body.email,
    otp: req.body.otp,
    ipAddress: req.ip,
  });
  sendResponse(res, 200, result, result.message);
});

const verifyEmailByQuery = async (req, res) => {
  const email = String(req.query.email || '').trim();
  const otp = String(req.query.otp || '').trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isOtpValid = /^\d{6}$/.test(otp);

  if (!isEmailValid || !isOtpValid) {
    return res
      .status(400)
      .type('html')
      .send(
        renderVerificationHtml({
          success: false,
          title: 'Verification failed',
          message: 'Invalid verification link. Please request a new email verification code.',
        })
      );
  }

  try {
    await authService.verifyEmail({ email, otp, ipAddress: req.ip });
    return res
      .status(200)
      .type('html')
      .send(
        renderVerificationHtml({
          success: true,
          title: 'Email verified',
          message: 'Your email was verified successfully. You can now continue using inDeal.',
        })
      );
  } catch (error) {
    const message = error?.message || 'Verification failed. Please try again.';
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    return res
      .status(statusCode)
      .type('html')
      .send(
        renderVerificationHtml({
          success: false,
          title: 'Verification failed',
          message,
        })
      );
  }
};

module.exports = {
  createRegistrationUploadUrl,
  register,
  resubmit,
  login,
  forgotPassword,
  resendForgotPasswordOtp,
  verifyOtp,
  resendVerification,
  verifyEmail,
  verifyEmailByQuery,
  resetPassword,
  logout,
};
