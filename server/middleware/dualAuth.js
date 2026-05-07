import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

const STAFF_ROLES = ['admin', 'staff', 'manager'];

/**
 * Allows staff JWT OR member JWT viewing only their own memberId.
 * Sets req.auth = { kind:'staff'|'member', ... }
 */
export async function staffOrOwnMember(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer')) {
    return next(new AppError('Not authorized', 401, 'NO_TOKEN'));
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError('Invalid token', 401, 'TOKEN_FAILED'));
  }

  const paramMemberId = req.params.userId || req.params.memberId;

  if (decoded.type === 'member') {
    if (String(decoded.memberId) !== String(paramMemberId)) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }
    req.auth = { kind: 'member', memberId: decoded.memberId };
    return next();
  }

  let role = decoded.role;
  if (!role && decoded.id) {
    const user = await User.findById(decoded.id).select('role');
    role = user?.role;
  }
  if (!STAFF_ROLES.includes(role)) {
    return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
  }
  req.auth = { kind: 'staff', staffId: decoded.id, role };
  next();
}
