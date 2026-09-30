import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { readBearerToken } from '../utils/bearer.js';

/**
 * Requires Bearer JWT with payload.type === 'member' and memberId.
 */
export function memberAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return next(new AppError('Sign in to continue', 401, 'NO_TOKEN'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'member' || !decoded.memberId) {
      return next(new AppError('Not authorized, invalid member token', 401, 'INVALID_TOKEN'));
    }
    req.member = {
      memberId: decoded.memberId,
      email: decoded.email,
      role: decoded.role || 'user',
    };
    next();
  } catch {
    return next(new AppError('Your session has expired. Sign in again.', 401, 'SESSION_EXPIRED'));
  }
}
