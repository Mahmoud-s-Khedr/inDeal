const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');

const supportedLanguages = [
    { code: 'en', label: 'English', default: true },
    { code: 'ar', label: 'Arabic', default: false },
];

const getStats = catchAsync(async (req, res) => {
    // Placeholder values until real aggregates are wired
    const stats = {
        companies: 0,
        deals: 0,
        locations: 0,
    };

    sendResponse(res, 200, stats, 'System stats fetched');
});

const getConfig = catchAsync(async (req, res) => {
    const config = {
        defaultLanguage: supportedLanguages.find((lang) => lang.default)?.code || 'en',
        languages: supportedLanguages,
    };

    sendResponse(res, 200, config, 'System config fetched');
});

module.exports = {
    getStats,
    getConfig,
};
