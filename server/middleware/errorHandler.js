import { logger } from '../utils/logger.js';

export class AppError extends Error {
  /**
   * @param {string} message  Human-readable, safe to show to end users.
   * @param {number} statusCode
   * @param {string} [code]   Stable machine-readable code the client can branch on.
   * @param {object} [details] Extra structured data (e.g. duplicate record ids, field errors).
   */
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** Map library errors (Mongoose, Multer, JSON parsing) onto AppError semantics in one place. */
function normalize(err) {
  if (err instanceof AppError) return err;
  if (err?.code === 'LIMIT_FILE_SIZE') return new AppError('File is larger than 5 MB', 400, 'FILE_TOO_LARGE');
  if (err?.name === 'CastError') return new AppError('Record not found', 404, 'NOT_FOUND');
  if (err?.name === 'ValidationError') {
    const fields = Object.fromEntries(Object.entries(err.errors || {}).map(([k, v]) => [k, v.message]));
    return new AppError('Some fields are invalid', 422, 'VALIDATION_ERROR', { fields });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    return new AppError(`A record with this ${field} already exists`, 409, 'DUPLICATE', { field });
  }
  if (err?.type === 'entity.parse.failed') return new AppError('Request body is not valid JSON', 400, 'INVALID_JSON');
  const wrapped = new AppError(err?.message || 'Something went wrong', err?.statusCode || err?.status || 500, err?.code && typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR');
  wrapped.stack = err?.stack;
  return wrapped;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(rawErr, req, res, next) {
  const err = normalize(rawErr);
  const { statusCode } = err;

  // `expose`: a 5xx whose message was written for users (an outside service is down or busy).
  if (statusCode >= 500 && !err.expose) {
    logger.error(err.stack || err.message, { path: req.path, method: req.method });
  } else {
    logger.warn(err.message, { path: req.path, code: err.code });
  }

  res.status(statusCode).json({
    success: false,
    // Never leak internal error text for 5xx outside development.
    message: statusCode >= 500 && !err.expose && process.env.NODE_ENV !== 'development' ? 'Something went wrong on our side. Try again.' : err.message,
    code: err.code,
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
}
