import { logger } from '../utils/logger.js';

/**
 * Centralized error handler. Expects errors with optional `statusCode` and `code`.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    err.statusCode = 400;
    err.message = 'File too large';
    err.code = 'FILE_TOO_LARGE';
  }
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Something went wrong';

  if (statusCode >= 500) {
    logger.error(err.stack || err.message, { path: req.path, method: req.method });
  } else {
    logger.warn(message, { path: req.path, code });
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
}

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} [code]
   */
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
