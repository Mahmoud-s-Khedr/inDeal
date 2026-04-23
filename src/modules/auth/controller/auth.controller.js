const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const authService = require('../service/auth.service');

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

module.exports = {
  createRegistrationUploadUrl,
  register,
  resubmit,
  login,
  forgotPassword,
  resendForgotPasswordOtp,
  verifyOtp,
  resetPassword,
  logout,
};
