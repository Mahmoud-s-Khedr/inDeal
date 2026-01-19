const catchAsync = require('../utils/catchAsync');
const notificationService = require('../services/notification.service');
const { sendResponse } = require('../utils/response');

const getMyNotifications = catchAsync(async (req, res) => {
  const result = await notificationService.getMyNotifications(req.user.id, req.query);
  sendResponse(res, 200, result);
});

const markAsRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAsRead(req.user.id, req.params.id);
  sendResponse(res, 200, result);
});

const markAllAsRead = catchAsync(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user.id);
  sendResponse(res, 200, result);
});

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};
