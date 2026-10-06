/**
 * Member app passwords (sign in with mobile number, email or member ID + password).
 *
 * - A member registered at the desk gets their date of birth as the first password, written
 *   DDMMYYYY (15 August 1995 → 15081995). Staff can reset it back to that; the member can change it.
 * - While a password is still that default, it's also accepted typed with separators
 *   (15-08-1995, 15/08/1995).
 * - 5 wrong passwords in 15 minutes lock that login for 15 minutes (on top of the per-IP limit).
 */
import bcrypt from 'bcryptjs';
import Member from '../models/Member.js';
import { AppError } from '../middleware/errorHandler.js';
import { canonicalPhone } from '../utils/strings.js';
import { toGymTime } from '../utils/time.js';
import { LOCKOUT, lockoutState, passwordProblem } from './staffAuthService.js';

const ROUNDS = 10;

/** The first password: date of birth as DDMMYYYY, on the gym's calendar. */
export const defaultMemberPassword = (dob) => toGymTime(dob).format('DDMMYYYY');

/** What staff tell the member, e.g. "15081995 (date of birth, DDMMYYYY)". */
export const describeDefaultPassword = (dob) => `${defaultMemberPassword(dob)} (date of birth, DDMMYYYY)`;

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

/** Fields that set the date-of-birth password. `revoke` signs out existing member sessions. */
export async function defaultPasswordFields(dob, { revoke = false, now = new Date() } = {}) {
  return {
    passwordHash: await bcrypt.hash(defaultMemberPassword(dob), ROUNDS),
    passwordSetAt: now,
    passwordIsDefault: true,
    ...(revoke && { passwordChangedAt: now }),
  };
}

/**
 * Staff saved a date of birth: a member without a password gets it as their first password, and a
 * password that is still the old default follows the corrected date. A chosen password is kept.
 * `member` is a document; returns true if the password changed.
 */
export async function applyDefaultPassword(member, now = new Date()) {
  if (!member.dob) return false;
  if (member.passwordSetAt && !member.passwordIsDefault) return false;
  member.set(await defaultPasswordFields(member.dob, { now }));
  return true;
}

/** Does `typed` match this member's password? `member` must include +passwordHash. */
export async function checkMemberPassword(member, typed) {
  if (!member?.passwordHash || typeof typed !== 'string' || !typed) return false;
  if (await bcrypt.compare(typed, member.passwordHash)) return true;
  // The default is digits only; accept it typed as a date (15-08-1995).
  if (member.passwordIsDefault) {
    const digits = digitsOnly(typed);
    return digits !== typed && digits.length === 8 && bcrypt.compare(digits, member.passwordHash);
  }
  return false;
}

/** Plain-language problem with a new member password, or null. */
export function memberPasswordProblem(password, member) {
  const basic = passwordProblem(password, { email: member.email });
  if (basic) return basic;
  const p = String(password);
  if (member.dob && digitsOnly(p) === defaultMemberPassword(member.dob)) return 'Don’t use your date of birth. Anyone who knows it could sign in.';
  if (member.phone && digitsOnly(p) === digitsOnly(member.phone)) return 'Don’t use your mobile number as your password.';
  return null;
}

// ── Finding the member a login belongs to ──────────────────────────────────

/** "98765 43210" / "+91…" → phone; "a@b.c" → email; "KFZ-0042" / "kfz0042" → member code. */
export function parseLogin(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (v.includes('@')) return { by: 'email', value: v.toLowerCase() };
  const code = /^([A-Za-z]{1,8})-?(\d{1,8})$/.exec(v);
  if (code) return { by: 'memberCode', value: `${code[1].toUpperCase()}-${code[2]}` };
  const phone = canonicalPhone(v);
  return digitsOnly(phone).length >= 10 ? { by: 'phone', value: phone } : null;
}

export async function membersForLogin(login) {
  const filter = { email: { email: login.value }, memberCode: { memberCode: login.value }, phone: { phone: login.value } }[login.by];
  return Member.find(filter).select('+passwordHash name email phone dob memberCode role profilePhoto passwordSetAt passwordIsDefault').sort({ createdAt: 1 }).limit(10);
}

// ── Lockout (in memory: one server process) ────────────────────────────────

const attempts = new Map();

const lockKey = (login) => `${login.by}:${login.value}`;

export function memberLockout(key, now = new Date()) {
  const since = now.getTime() - LOCKOUT.windowMinutes * 60_000;
  const events = (attempts.get(key) || []).filter((t) => t >= since);
  attempts.set(key, events);
  return lockoutState(events.map((t) => ({ at: new Date(t), success: false, reason: 'wrong_password' })).reverse(), now);
}

export function recordMemberFailure(key, now = new Date()) {
  attempts.set(key, [...(attempts.get(key) || []), now.getTime()]);
  // Keep the map small: forget logins whose failures are all older than the window.
  if (attempts.size > 5000) {
    const since = now.getTime() - LOCKOUT.windowMinutes * 60_000;
    for (const [k, times] of attempts) if (times.every((t) => t < since)) attempts.delete(k);
  }
}

export const clearMemberFailures = (key) => attempts.delete(key);

/** For tests. */
export const resetMemberLockouts = () => attempts.clear();

const lockedError = (minutes) =>
  new AppError(`Too many wrong passwords. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, or sign in with your mobile number instead.`, 429, 'LOGIN_LOCKED', { retryAfterMinutes: minutes });

/**
 * The member this login + password signs in. Throws plain-language errors:
 * 401 WRONG_PASSWORD, 409 NO_PASSWORD (account has none yet), 409 CHOOSE_MEMBER (shared phone), 429 LOGIN_LOCKED.
 */
export async function memberForPassword({ login: raw, password, memberId }, now = new Date()) {
  const login = parseLogin(raw);
  if (!login) throw new AppError('Enter your mobile number, email or member ID', 422, 'VALIDATION_ERROR', { fields: { login: 'Enter your mobile number, email or member ID' } });
  const key = lockKey(login);
  const lock = memberLockout(key, now);
  if (lock.locked) throw lockedError(lock.retryAfterMinutes);

  const candidates = await membersForLogin(login);
  const withPassword = candidates.filter((m) => m.passwordHash);
  const matched = [];
  for (const m of withPassword) if (await checkMemberPassword(m, password)) matched.push(m);

  if (!matched.length) {
    if (candidates.length && !withPassword.length) {
      throw new AppError('This account has no password yet. Sign in with your mobile number, or ask the gym desk to set one.', 409, 'NO_PASSWORD');
    }
    recordMemberFailure(key, now);
    const after = memberLockout(key, now);
    if (after.locked) throw lockedError(after.retryAfterMinutes);
    throw new AppError('Wrong login or password. Check them and try again.', 401, 'WRONG_PASSWORD', { fields: { password: 'Wrong login or password' } });
  }
  clearMemberFailures(key);
  if (matched.length === 1) return matched[0];
  const chosen = memberId && matched.find((m) => String(m._id) === String(memberId));
  if (chosen) return chosen;
  throw new AppError('More than one member uses this login. Choose who you are.', 409, 'CHOOSE_MEMBER', {
    candidates: matched.map((m) => ({ id: String(m._id), name: m.name, memberCode: m.memberCode })),
  });
}

/**
 * The member changes (or, if they have none, sets) their password. Returns the saved member.
 * @param {{ currentPassword?: string, newPassword: string, confirmPassword: string }} input
 */
export async function changeMemberPassword(memberId, input, now = new Date()) {
  const member = await Member.findById(memberId).select('+passwordHash name email phone dob passwordSetAt passwordIsDefault');
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const fields = {};
  const key = `member:${memberId}`;
  if (member.passwordHash) {
    const lock = memberLockout(key, now);
    if (lock.locked) throw lockedError(lock.retryAfterMinutes);
    if (!(await checkMemberPassword(member, input.currentPassword || ''))) {
      recordMemberFailure(key, now);
      fields.currentPassword = input.currentPassword ? 'That isn’t your current password' : 'Enter your current password';
    }
  }
  const problem = memberPasswordProblem(input.newPassword, member);
  if (problem) fields.newPassword = problem;
  else if (member.passwordHash && !fields.currentPassword && (await bcrypt.compare(input.newPassword, member.passwordHash))) {
    fields.newPassword = 'Choose a password different from your current one.';
  }
  if (input.newPassword !== input.confirmPassword) fields.confirmPassword = 'The two new passwords don’t match.';
  if (Object.keys(fields).length) throw new AppError(Object.values(fields)[0], 422, 'VALIDATION_ERROR', { fields });

  clearMemberFailures(key);
  member.set({ passwordHash: await bcrypt.hash(input.newPassword, ROUNDS), passwordSetAt: now, passwordIsDefault: false, passwordChangedAt: now });
  await member.save();
  return member;
}

/** Staff put the password back to the date of birth (member forgot theirs). Signs the member out elsewhere. */
export async function resetMemberPassword(memberId, now = new Date()) {
  const member = await Member.findById(memberId).select('name dob passwordSetAt passwordIsDefault');
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (!member.dob) throw new AppError('Add the member’s date of birth first: it becomes their password.', 422, 'NO_DOB');
  member.set(await defaultPasswordFields(member.dob, { revoke: true, now }));
  await member.save();
  return member;
}

/** What staff and the member see about the app password (never the password itself). */
export const appPasswordInfo = (m) => ({ set: Boolean(m?.passwordSetAt), isDefault: Boolean(m?.passwordSetAt && m.passwordIsDefault), setAt: m?.passwordSetAt || null });
