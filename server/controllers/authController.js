import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const STAFF_SESSION_TTL = process.env.STAFF_JWT_EXPIRES || '12h';

export function signStaffToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, type: 'staff' },
    process.env.JWT_SECRET,
    { expiresIn: STAFF_SESSION_TTL }
  );
}

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email });
  // Same message for unknown email and wrong password, so accounts can't be enumerated.
  const valid = user && (await user.comparePassword(password));
  if (!valid) throw new AppError('Email or password is incorrect', 401, 'INVALID_CREDENTIALS');
  if (user.isActive === false) throw new AppError('Your staff account is not active. Ask the owner to reactivate it.', 403, 'ACCOUNT_INACTIVE');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signStaffToken(user);
  const { exp } = jwt.decode(token) || {};
  res.json({ success: true, token, expiresAt: exp ? new Date(exp * 1000) : null, user: user.toPublic() });
});

/** GET /api/auth/me — validates the stored session on app start. */
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.staffUser });
});
