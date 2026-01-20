/**
 * Device Token Controller
 * Manages FCM device tokens for push notifications
 */

const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const deviceTokenService = require('../services/deviceToken.service');

/**
 * Register a device token
 * POST /api/v1/users/me/devices
 */
const registerDevice = catchAsync(async (req, res) => {
    const { token, deviceType, deviceInfo } = req.body;
    const result = await deviceTokenService.registerDevice(req.user.id, token, deviceType, deviceInfo);
    sendResponse(res, 201, result, 'Device registered');
});

/**
 * Unregister a device token
 * DELETE /api/v1/users/me/devices
 */
const unregisterDevice = catchAsync(async (req, res) => {
    const { token } = req.body;
    await deviceTokenService.unregisterDevice(req.user.id, token);
    sendResponse(res, 200, null, 'Device unregistered');
});

/**
 * List user's registered devices
 * GET /api/v1/users/me/devices
 */
const listDevices = catchAsync(async (req, res) => {
    const devices = await deviceTokenService.getUserDevices(req.user.id);
    sendResponse(res, 200, devices, 'Devices fetched');
});

module.exports = {
    registerDevice,
    unregisterDevice,
    listDevices,
};
