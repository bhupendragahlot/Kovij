import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

const STAFF_ROLES = ['admin', 'staff', 'manager'];

/**
 * Staff JWT (existing /api/auth login). Rejects member tokens.
 * Attaches req.staffUser { id, email, role }.
 */
export async function adminAuth(req, res, next) {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('Not authorized, no token', 401, 'NO_TOKEN'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'member') {
      return next(new AppError('Staff access only', 403, 'FORBIDDEN'));
    }
    // Legacy tokens: no `type` field — treat as staff session

    let role = decoded.role;
    if (!role && decoded.id) {
      const user = await User.findById(decoded.id).select('role email username');
      if (!user) return next(new AppError('User not found', 401, 'USER_NOT_FOUND'));
      role = user.role;
      req.staffUser = {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        role: user.role,
      };
    } else {
      req.staffUser = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        role,
      };
    }

    if (!STAFF_ROLES.includes(req.staffUser.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }
    next();
  } catch (e) {
    if (e instanceof AppError) return next(e);
    return next(new AppError('Not authorized, token failed', 401, 'TOKEN_FAILED'));
  }
}
