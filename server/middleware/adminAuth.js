import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';
import { readBearerToken } from '../utils/bearer.js';

export const STAFF_ROLES = ['admin', 'manager', 'staff'];

/**
 * Resolve the staff user behind a verified token. The user is re-read on every request so
 * that role changes and deactivations take effect immediately, not when the JWT expires.
 */
export async function loadStaffFromToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Your session has expired. Sign in again.', 401, 'SESSION_EXPIRED');
  }
  if (decoded.type === 'member' || !decoded.id) {
    throw new AppError('This area is for gym staff only', 403, 'FORBIDDEN');
  }
  const user = await User.findById(decoded.id).select('username name email role isActive').lean();
  if (!user || user.isActive === false) {
    throw new AppError('Your staff account is not active', 401, 'ACCOUNT_INACTIVE');
  }
  if (!STAFF_ROLES.includes(user.role)) {
    throw new AppError('This area is for gym staff only', 403, 'FORBIDDEN');
  }
  return {
    id: String(user._id),
    email: user.email,
    username: user.username,
    name: user.name || user.username,
    role: user.role,
  };
}

/** Require a valid staff session. Attaches `req.staffUser`. */
export async function adminAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return next(new AppError('Sign in to continue', 401, 'NO_TOKEN'));
  try {
    req.staffUser = await loadStaffFromToken(token);
    next();
  } catch (e) {
    next(e);
  }
}
