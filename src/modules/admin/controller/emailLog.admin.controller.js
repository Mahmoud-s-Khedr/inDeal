const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const { emailLogAdminService } = require('../service');

const listEmailLogs = catchAsync(async (req, res) => {
  const result = await emailLogAdminService.listEmailLogs(req.query);
  sendResponse(res, 200, result, 'Email logs fetched successfully');
});

const getEmailLogById = catchAsync(async (req, res) => {
  const result = await emailLogAdminService.getEmailLogById(Number(req.params.id));
  sendResponse(res, 200, result, 'Email log fetched successfully');
});

module.exports = {
  listEmailLogs,
  getEmailLogById,
};
