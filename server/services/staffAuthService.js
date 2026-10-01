/**
 * OWNER: security module. Staff sign-in protection and password resets.
 *
 *  - Every sign-in attempt is recorded (LoginEvent).
 *  - An account is locked for 15 minutes after 5 wrong passwords in 15 minutes (on top of the
 *    per-IP rate limiter). The lock applies to the typed email, whether or not the account exists,
 *    so the lock itself doesn't reveal which emails are staff accounts.
 *  - Reset links are single-use, expire in an hour, and only their hash is stored.
 */
import crypto from 'node:crypto';
import LoginEvent from '../models/LoginEvent.js';
import PasswordReset from '../models/PasswordReset.js';
import { queueEmail } from './emailService.js';
import { getSettingsDoc } from '../models/Settings.js';
import { logger } from '../utils/logger.js';
import './emailTemplates/securityEmails.js';

export const LOCKOUT = { maxFailures: 5, windowMinutes: 15 };
export const RESET_LINK_MINUTES = 60;
export const MIN_PASSWORD = 8;

/**
 * Pure: is this email locked right now? `events` are its recent attempts, newest first.
 * Failures only count since the last successful sign-in (or reset).
 * @returns {{ locked: boolean, retryAfterMinutes: number, attemptsLeft: number }}
 */
export function lockoutState(events, now = new Date(), { maxFailures, windowMinutes } = LOCKOUT) {
  const windowStart = now.getTime() - windowMinutes * 60_000;
  const failures = [];
  for (const e of events) {
    const at = new Date(e.at).getTime();
    if (at < windowStart) break;
    if (e.success) break;
    if (e.reason !== 'locked') failures.push(at);
  }
  if (failures.length < maxFailures) return { locked: false, retryAfterMinutes: 0, attemptsLeft: maxFailures - failures.length };
  // `failures` is newest first: fewer than maxFailures remain once the maxFailures-th newest leaves the window.
  const unlockAt = failures[maxFailures - 1] + windowMinutes * 60_000;
  const locked = unlockAt > now.getTime();
  return { locked, retryAfterMinutes: locked ? Math.max(1, Math.ceil((unlockAt - now.getTime()) / 60_000)) : 0, attemptsLeft: locked ? 0 : 1 };
}

export async function checkLockout(email, now = new Date()) {
  const since = new Date(now.getTime() - LOCKOUT.windowMinutes * 60_000);
  const events = await LoginEvent.find({ email, at: { $gte: since } }).sort({ at: -1 }).limit(50).lean();
  return lockoutState(events, now);
}

export function recordLoginEvent({ req, email, user, success, reason }) {
  return LoginEvent.create({
    email,
    userId: user?._id,
    success,
    reason,
    ip: req?.ip,
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 300),
  }).catch((err) => logger.warn(`login event write failed: ${err.message}`));
}

/** Plain-language problem with a new password, or null when it's fine. */
export function passwordProblem(password, { email, username } = {}) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (p.length > 128) return 'Use at most 128 characters.';
  const lower = p.toLowerCase();
  if (email && lower === String(email).toLowerCase()) return 'Don’t use your email address as your password.';
  if (username && lower === String(username).toLowerCase()) return 'Don’t use your username as your password.';
  if (/^(.)\1+$/.test(p)) return 'Don’t repeat one character.';
  if (['password', 'password1', '12345678', '123456789', 'qwertyui', 'kovij123'].includes(lower)) return 'That password is too easy to guess.';
  return null;
}

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// The e2e suite can't read email, so in test mode the last link per user is kept in memory.
const testLinks = new Map();
export const lastResetTokenForTests = (userId) => (process.env.NODE_ENV === 'test' ? testLinks.get(String(userId)) : undefined);

function resetUrl(token) {
  const base = (process.env.APP_URL || 'https://kovij.onrender.com').trim().replace(/\/+$/, '');
  return `${base}/admin/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Create a reset link for a staff user and email it. Earlier unused links stop working.
 * @param {{ user: import('mongoose').Document, requestedBy?: string, ip?: string }} opts
 */
export async function sendResetLink({ user, requestedBy, ip }) {
  const token = crypto.randomBytes(32).toString('base64url');
  await PasswordReset.deleteMany({ userId: user._id, usedAt: { $exists: false } });
  await PasswordReset.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000),
    requestedBy: requestedBy || user._id,
    ip,
  });
  if (process.env.NODE_ENV === 'test') testLinks.set(String(user._id), token);

  const settings = await getSettingsDoc();
  await queueEmail({
    to: user.email,
    templateKey: 'staffPasswordReset',
    vars: {
      name: user.name || user.username,
      link: resetUrl(token),
      minutes: RESET_LINK_MINUTES,
      gymName: settings.gymName,
      byAdmin: Boolean(requestedBy && String(requestedBy) !== String(user._id)),
    },
  });
}

/** The reset record for a token, if it's still usable. */
export async function findUsableReset(token, now = new Date()) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  return PasswordReset.findOne({ tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: now } });
}

/** Tell someone their password changed (so they notice if it wasn't them). */
export async function sendPasswordChangedNotice(user) {
  const settings = await getSettingsDoc();
  await queueEmail({
    to: user.email,
    templateKey: 'staffPasswordChanged',
    vars: { name: user.name || user.username, gymName: settings.gymName, at: new Date() },
  }).catch((err) => logger.warn(`password-changed email failed: ${err.message}`));
}
