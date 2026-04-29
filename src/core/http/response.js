const AppError = require('../errors/AppError');
const { getHttpContractForRequest } = require('../contracts/http/registry');

const sendResponse = (res, statusCode, data, message = 'Success') => {
  const req = res.req;
  const payload = {
    status: 'success',
    message,
    data,
  };

  if (res.locals.accessToken) {
    payload.token = res.locals.accessToken;
  }

  const contract = getHttpContractForRequest(req);
  if (contract?.successResponseSchema) {
    const parsed = contract.successResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(
        `Response DTO validation failed for ${req.method} ${req.originalUrl}: ${parsed.error.message}`,
        500
      );
    }
  }

  res.locals.responseData = payload;
  res.status(statusCode).json(payload);
};

module.exports = sendResponse;
