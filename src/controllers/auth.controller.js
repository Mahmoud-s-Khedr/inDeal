const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');

const register = catchAsync(async (req, res) => {
    const result = await authService.register(req.body);
    sendResponse(res, 201, result, 'Registration submitted successfully');
});

const login = catchAsync(async (req, res) => {
    const result = await authService.login(req.body);
    sendResponse(res, 200, result, 'Login successful');
});

module.exports = {
    register,
    login,
};
