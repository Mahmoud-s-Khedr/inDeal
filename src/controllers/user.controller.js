const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const userService = require('../services/user.service');

const getMe = catchAsync(async (req, res) => {
  const me = await userService.getMe(req.user.id);
  sendResponse(res, 200, me, 'User profile fetched');
});

const updateMe = catchAsync(async (req, res) => {
  const me = await userService.updateMe(req.user.id, req.body);
  sendResponse(res, 200, me, 'User profile updated');
});

const updatePassword = catchAsync(async (req, res) => {
  await userService.updatePassword(req.user.id, req.body);
  sendResponse(
    res,
    200,
    { message: 'Password updated successfully.' },
    'Password updated successfully.'
  );
});

const updateProfileImage = catchAsync(async (req, res) => {
  const me = await userService.updateProfileImage(req.user.id, req.body);
  sendResponse(res, 200, me, 'Profile image updated');
});

module.exports = {
  getMe,
  updateMe,
  updatePassword,
  updateProfileImage,
};
