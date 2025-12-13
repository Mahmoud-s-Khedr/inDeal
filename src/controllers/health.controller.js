const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const healthCheck = catchAsync(async (req, res) => {
    sendResponse(res, 200, {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date(),
    }, 'inDeal API is healthy');
});

module.exports = {
    healthCheck,
};
