import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';
import { readBearerToken } from '../utils/bearer.js';
import { loadStaffFromToken } from './adminAuth.js';

/**
 * Allows a staff session, or a member session viewing only their own memberId.
 * Sets req.auth = { kind: 'staff'|'member', ... }
 */
export async function staffOrOwnMember(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return next(new AppError('Sign in to continue', 401, 'NO_TOKEN'));

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError('Your session has expired. Sign in again.', 401, 'SESSION_EXPIRED'));
  }

  if (decoded.type === 'member') {
    const paramMemberId = req.params.userId || req.params.memberId;
    if (String(decoded.memberId) !== String(paramMemberId)) {
      return next(new AppError('Forbidden', 403, 'FORBIDDEN'));
    }
    req.auth = { kind: 'member', memberId: decoded.memberId };
    return next();
  }

  try {
    const staff = await loadStaffFromToken(token);
    req.auth = { kind: 'staff', staffId: staff.id, role: staff.role };
    next();
  } catch (e) {
    next(e);
  }
}
