const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');

const createRegistrationUploadUrl = catchAsync(async (req, res) => {
    const signedUpload = await authService.createRegistrationUploadUrl(req.body);
    sendResponse(res, 201, signedUpload, 'Signed upload URL generated');
});

const register = catchAsync(async (req, res) => {
    const result = await authService.register(req.body);
    sendResponse(res, 201, result, 'Registration submitted successfully');
});

const login = catchAsync(async (req, res) => {
    const result = await authService.login(req.body);
    sendResponse(res, 200, result, 'Login successful');
});

const adminLogin = catchAsync(async (req, res) => {
    const result = await authService.adminLogin(req.body);
    sendResponse(res, 200, result, 'Admin login successful');
});

module.exports = {
    createRegistrationUploadUrl,
    register,
    login,
    adminLogin,
};
