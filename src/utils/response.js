const sendResponse = (res, statusCode, data, message = 'Success') => {
  const payload = {
    status: 'success',
    message,
    data,
  };

  if (res.locals.accessToken) {
    payload.token = res.locals.accessToken;
  }

  res.locals.responseData = payload;
  res.status(statusCode).json(payload);
};

module.exports = sendResponse;
