import { AppError } from './errorHandler.js';

/**
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return next(new AppError(msg, 422, 'VALIDATION_ERROR'));
    }
    req.validated = req.validated || {};
    req.validated[source] = parsed.data;
    next();
  };
}
