/**
 * Wraps async route handlers so errors propagate to error middleware.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
