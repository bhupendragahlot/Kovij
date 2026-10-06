import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Member from '../models/Member.js';
import { AppError } from './errorHandler.js';
import { readBearerToken } from '../utils/bearer.js';

/**
 * Requires Bearer JWT with payload.type === 'member' and memberId. A password change or reset
 * signs out every session issued before it.
 */
export async function memberAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) {
    return next(new AppError('Sign in to continue', 401, 'NO_TOKEN'));
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new AppError('Your session has expired. Sign in again.', 401, 'SESSION_EXPIRED'));
  }
  if (decoded.type !== 'member' || !decoded.memberId) {
    return next(new AppError('Not authorized, invalid member token', 401, 'INVALID_TOKEN'));
  }
  if (mongoose.isValidObjectId(decoded.memberId)) {
    try {
      const member = await Member.findById(decoded.memberId).select('passwordChangedAt').lean();
      if (member?.passwordChangedAt && decoded.iat * 1000 < new Date(member.passwordChangedAt).getTime() - 1000) {
        return next(new AppError('Your password was changed. Sign in again.', 401, 'SESSION_REVOKED'));
      }
    } catch (e) {
      return next(e);
    }
  }
  req.member = {
    memberId: decoded.memberId,
    email: decoded.email,
    role: decoded.role || 'user',
  };
  next();
}
