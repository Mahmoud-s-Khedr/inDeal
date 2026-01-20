const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const adminUserService = require('../services/adminUser.service');

const changeAgentEmail = catchAsync(async (req, res) => {
  const result = await adminUserService.changeAgentEmail(req.params.id, req.body.email);
  sendResponse(res, 200, result, 'Agent email updated');
});

module.exports = {
  changeAgentEmail,
};
