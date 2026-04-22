const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const supportService = require('../service/support.service');

const getSupportInfo = catchAsync(async (req, res) => {
  const info = supportService.getSupportInfo();
  sendResponse(res, 200, info, 'Support info fetched');
});

const getEmailSupportRedirect = catchAsync(async (req, res) => {
  const payload = supportService.getEmailSupportRedirect();
  sendResponse(res, 200, payload, 'Email support redirect payload fetched');
});

module.exports = {
  getSupportInfo,
  getEmailSupportRedirect,
};
