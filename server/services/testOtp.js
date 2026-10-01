/**
 * Test-mode mobile sign-in: when DEFAULT_OTP is set (DEFULT_OTP is accepted too), the phone
 * sign-in skips SMS and accepts that fixed code for any number. For development and demos,
 * before SMS is set up (Firebase SMS needs the Blaze plan).
 *
 * A fixed code lets anyone who knows a member's phone number into their account, so it is
 * refused whenever NODE_ENV=production, whatever the value.
 */
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

const raw = (env) => String(env.DEFAULT_OTP ?? env.DEFULT_OTP ?? '').trim();

/** The test code, or null when test mode is off (unset, malformed, or production). */
export function testOtpCode(env = process.env) {
  const code = raw(env);
  if (!code || env.NODE_ENV === 'production') return null;
  return /^\d{4,8}$/.test(code) ? code : null;
}

export const isTestOtpOn = (env = process.env) => testOtpCode(env) !== null;

/** Timing-safe comparison against the test code. */
export function matchesTestOtp(input, env = process.env) {
  const code = testOtpCode(env);
  if (!code) return false;
  const a = Buffer.from(String(input ?? '').trim());
  const b = Buffer.from(code);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Say loudly, once at startup, what the setting is doing. */
export function reportTestOtpMode(env = process.env) {
  const code = raw(env);
  if (!code) return;
  if (env.NODE_ENV === 'production') {
    logger.error('DEFAULT_OTP is set but ignored because NODE_ENV=production. Remove it from the live server’s settings.');
  } else if (!/^\d{4,8}$/.test(code)) {
    logger.warn('DEFAULT_OTP must be 4 to 8 digits; test sign-in is off.');
  } else {
    logger.warn('TEST MODE: mobile sign-in accepts the fixed DEFAULT_OTP code for ANY phone number and sends no SMS. Never use this on the live site.');
  }
}
