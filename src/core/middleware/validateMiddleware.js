const AppError = require('../errors/AppError');
const { z } = require('zod');

const validate = (schema) => {
  const validator = (req, res, next) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Express 5 exposes req.query through a getter, so assigning the parsed
      // query back to req.query is neither reliable nor supported. Keep the
      // coerced/defaulted request data on a dedicated property instead.
      req.validated = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues =
          Array.isArray(err.errors) && err.errors.length ? err.errors : err.issues || [];
        const errorMessages =
          issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ') || err.message;
        return next(new AppError(`Validation Error: ${errorMessages}`, 400));
      }
      next(err);
    }
  };

  validator.__isValidationMiddleware = true;
  validator.__validationSchema = schema;
  return validator;
};

module.exports = validate;
