import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import LoginEvent from '../models/LoginEvent.js';
import PasswordReset from '../models/PasswordReset.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import {
  checkLockout,
  findUsableReset,
  lastResetTokenForTests,
  passwordProblem,
  recordLoginEvent,
  sendPasswordChangedNotice,
  sendResetLink,
} from '../services/staffAuthService.js';
import { deviceLabel, recordActivity } from '../services/activityService.js';

const STAFF_SESSION_TTL = process.env.STAFF_JWT_EXPIRES || '12h';

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('kovij-timing-equaliser', 10);

export function signStaffToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, type: 'staff' },
    process.env.JWT_SECRET,
    { expiresIn: STAFF_SESSION_TTL }
  );
}

function sessionResponse(user) {
  const token = signStaffToken(user);
  const { exp } = jwt.decode(token) || {};
  return { token, expiresAt: exp ? new Date(exp * 1000) : null, user: user.toPublic() };
}

const lockedError = (minutes) =>
  new AppError(
    `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
    429,
    'ACCOUNT_LOCKED',
    { retryAfterMinutes: minutes }
  );

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;

  const [lock, user] = await Promise.all([checkLockout(email), User.findOne({ email })]);
  if (lock.locked) {
    await recordLoginEvent({ req, email, user, success: false, reason: 'locked' });
    throw lockedError(lock.retryAfterMinutes);
  }

  const valid = user ? await user.comparePassword(password) : (await bcrypt.compare(password, DUMMY_HASH)) && false;
  if (!valid) {
    await recordLoginEvent({ req, email, user, success: false, reason: user ? 'wrong_password' : 'unknown_account' });
    const after = await checkLockout(email);
    if (after.locked) throw lockedError(after.retryAfterMinutes);
    // Same message for unknown email and wrong password, so accounts can't be enumerated.
    throw new AppError(
      after.attemptsLeft <= 2
        ? `Email or password is incorrect. ${after.attemptsLeft} more ${after.attemptsLeft === 1 ? 'try' : 'tries'} before sign-in is paused for 15 minutes.`
        : 'Email or password is incorrect',
      401,
      'INVALID_CREDENTIALS',
      { attemptsLeft: after.attemptsLeft }
    );
  }
  if (user.isActive === false) {
    await recordLoginEvent({ req, email, user, success: false, reason: 'inactive' });
    throw new AppError('Your staff account is not active. Ask the owner to reactivate it.', 403, 'ACCOUNT_INACTIVE');
  }

  user.lastLoginAt = new Date();
  await user.save();
  await recordLoginEvent({ req, email, user, success: true, reason: 'ok' });
  res.json({ success: true, ...sessionResponse(user) });
});

/** GET /api/auth/me — validates the stored session on app start. */
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.staffUser });
});

const FORGOT_MESSAGE = 'If this email belongs to an active staff account, we’ve sent a link to set a new password. It works for 1 hour.';

/** POST /api/auth/forgot-password — the same answer whether or not the account exists. */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.validated.body;
  res.json({ success: true, message: FORGOT_MESSAGE });
  // After answering, so the response time doesn't reveal whether the account exists.
  try {
    const user = await User.findOne({ email });
    if (user && user.isActive !== false) await sendResetLink({ user, ip: req.ip });
  } catch (err) {
    logger.warn(`password reset request failed: ${err.message}`);
  }
});

/** GET /api/auth/reset-password?token= — lets the page say "expired" before anyone types. */
export const checkResetLink = asyncHandler(async (req, res) => {
  const reset = await findUsableReset(req.validated.query.token);
  const user = reset && (await User.findById(reset.userId).select('email name isActive').lean());
  if (!user || user.isActive === false) return res.json({ success: true, valid: false });
  res.json({ success: true, valid: true, name: user.name || '', email: user.email, expiresAt: reset.expiresAt });
});

const linkGone = () => new AppError('This reset link has expired or was already used. Ask for a new one.', 410, 'RESET_LINK_INVALID');

/** POST /api/auth/reset-password */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.validated.body;
  const reset = await findUsableReset(token);
  if (!reset) throw linkGone();
  const user = await User.findById(reset.userId);
  if (!user || user.isActive === false) throw linkGone();

  const problem = passwordProblem(password, user);
  if (problem) throw new AppError(problem, 422, 'VALIDATION_ERROR', { fields: { password: problem } });

  // Claim the link atomically, so two tabs can't both use it.
  const claimed = await PasswordReset.findOneAndUpdate({ _id: reset._id, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } });
  if (!claimed) throw linkGone();

  user.password = password;
  user.passwordChangedAt = new Date(); // signs out every existing session
  await user.save();
  await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });

  // A completed reset also clears any sign-in lock on the account.
  await recordLoginEvent({ req, email: user.email, user, success: true, reason: 'password_reset' });
  recordActivity({
    actor: { id: user._id, name: user.name || user.username, role: user.role },
    method: 'POST',
    route: '/auth/reset-password',
    action: 'auth.reset_password',
    kind: 'other',
    entityType: 'staff',
    entityId: String(user._id),
    status: 200,
    ok: true,
    ip: req.ip,
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
  });
  sendPasswordChangedNotice(user);
  res.json({ success: true, message: 'Password changed. Sign in with your new password.' });
});

/** POST /api/auth/change-password — signed in; other devices are signed out, this one continues. */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  const user = await User.findById(req.staffUser.id);
  if (!user) throw new AppError('Staff account not found', 404, 'NOT_FOUND');
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Your current password is wrong', 422, 'VALIDATION_ERROR', { fields: { currentPassword: 'That isn’t your current password' } });
  }
  if (currentPassword === newPassword) {
    throw new AppError('Choose a new password', 422, 'VALIDATION_ERROR', { fields: { newPassword: 'Choose a password different from your current one' } });
  }
  const problem = passwordProblem(newPassword, user);
  if (problem) throw new AppError(problem, 422, 'VALIDATION_ERROR', { fields: { newPassword: problem } });

  user.password = newPassword;
  user.passwordChangedAt = new Date();
  await user.save();
  sendPasswordChangedNotice(user);
  res.json({ success: true, message: 'Password changed. Other devices were signed out.', ...sessionResponse(user) });
});

const eventView = (e) => ({
  id: String(e._id),
  at: e.at,
  success: e.success,
  reason: e.reason,
  ip: e.ip || '',
  device: deviceLabel(e.userAgent),
});

/** GET /api/auth/sign-ins — my recent sign-ins (Settings > My account). */
export const mySignIns = asyncHandler(async (req, res) => {
  const events = await LoginEvent.find({ $or: [{ userId: req.staffUser.id }, { email: req.staffUser.email }] })
    .sort({ at: -1 })
    .limit(20)
    .lean();
  res.json({ success: true, items: events.map(eventView) });
});

/** GET /api/auth/_test/reset-token?userId= — test mode only (e2e can't read email). */
export const testResetToken = asyncHandler(async (req, res) => {
  res.json({ success: true, token: lastResetTokenForTests(req.query.userId) || null });
});

export { eventView };
