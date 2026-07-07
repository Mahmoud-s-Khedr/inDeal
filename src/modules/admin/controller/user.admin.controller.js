const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const { userAdminService } = require('../service');

const listUsers = catchAsync(async (req, res) => {
  const result = await userAdminService.listUsers(req.query);
  sendResponse(res, 200, result, 'Users fetched successfully');
});

const getUserById = catchAsync(async (req, res) => {
  const result = await userAdminService.getUserById(Number(req.params.id));
  sendResponse(res, 200, result, 'User fetched successfully');
});

const updateUserStatus = catchAsync(async (req, res) => {
  const result = await userAdminService.updateUserStatus(
    req.user.id,
    Number(req.params.id),
    req.body
  );
  sendResponse(res, 200, result, 'User status updated successfully');
});

const updateUserRole = catchAsync(async (req, res) => {
  const result = await userAdminService.updateUserRole(
    req.user.id,
    Number(req.params.id),
    req.body
  );
  sendResponse(res, 200, result, 'User role updated successfully');
});

module.exports = {
  listUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
};
