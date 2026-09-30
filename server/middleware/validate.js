import { AppError } from './errorHandler.js';

/**
 * Validate `req[source]` against a Zod schema. On success the parsed (coerced) data is
 * available at `req.validated[source]`; on failure a 422 carries per-field messages so
 * forms can place each error next to its input.
 *
 * @param {import('zod').ZodSchema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    // A malformed id in the URL means "no such record", not a form error.
    if (!parsed.success && source === 'params') {
      return next(new AppError('Record not found', 404, 'NOT_FOUND'));
    }
    if (!parsed.success) {
      const fields = {};
      for (const issue of parsed.error.errors) {
        const key = issue.path.join('.') || '_';
        if (!fields[key]) fields[key] = issue.message;
      }
      const first = Object.entries(fields)[0];
      const message = first ? `${first[0] === '_' ? '' : `${first[0]}: `}${first[1]}` : 'Some fields are invalid';
      return next(new AppError(message, 422, 'VALIDATION_ERROR', { fields }));
    }
    req.validated = req.validated || {};
    req.validated[source] = parsed.data;
    next();
  };
}
