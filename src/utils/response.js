const sendResponse = (res, statusCode, data, message = 'Success') => {
    const payload = {
        status: 'success',
        message,
        data,
    };

    res.locals.responseData = payload;
    res.status(statusCode).json(payload);
};

module.exports = sendResponse;
