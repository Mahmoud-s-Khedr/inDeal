const sendResponse = require('../../../core/http/response');
const catchAsync = require('../../../core/http/catchAsync');
const searchService = require('../service/search.service');

const search = catchAsync(async (req, res) => {
  const result = await searchService.search(req.query, req.user || null);
  sendResponse(res, 200, result, 'Search results fetched');
});

module.exports = {
  search,
};
