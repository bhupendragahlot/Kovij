import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

/**
 * Requires Bearer JWT with payload.type === 'member' and memberId.
 */
export function memberAuth(req, res, next) {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('Not authorized, no token', 401, 'NO_TOKEN'));
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
    return next(new AppError('Not authorized, token failed', 401, 'TOKEN_FAILED'));
  }
}
