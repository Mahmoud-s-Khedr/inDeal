const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const adminDashboardService = require('../services/adminDashboard.service');

const getDashboardCards = catchAsync(async (req, res) => {
  const cards = await adminDashboardService.getDashboardCards();
  sendResponse(res, 200, cards, 'Dashboard cards fetched');
});

module.exports = {
  getDashboardCards,
};
