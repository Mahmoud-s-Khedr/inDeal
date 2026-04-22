const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const supportService = require('../services/support.service');

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
