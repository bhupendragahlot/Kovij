import { z } from 'zod';
import { objectId } from './common.js';
import { canonicalPhone } from '../utils/strings.js';

/** Indian 10-digit numbers (with or without +91/0) or +country code; stored like the desk stores them. */
const mobile = z
  .string({ required_error: 'Enter your mobile number' })
  .trim()
  .transform((v) => canonicalPhone(v) || '')
  .refine((v) => /^\d{10}$/.test(v) || /^\+\d{8,15}$/.test(v), 'Enter a 10-digit mobile number, or + and your country code');

export const otpRequestSchema = z.object({ phone: mobile });

/** The ID token (JWT) the "Sign in with Google" button hands the page. */
export const googleIdSchema = z.object({
  credential: z.string().trim().min(20, 'Missing Google sign-in').max(8000),
});

export const otpVerifySchema = z.object({
  phone: mobile,
  code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code'),
  name: z.string().trim().max(120).optional(),
  memberId: z.union([z.literal('new'), objectId]).optional(),
});

/** Any Firebase sign-in (Google, email/password, phone OTP) exchanged for a member session. */
export const memberSessionSchema = z.object({
  idToken: z.string().min(10, 'idToken is required').max(8000),
  /** For a new account when the sign-in has no name (phone, email). */
  name: z.string().trim().max(120).optional(),
  /** Answer to CHOOSE_MEMBER: one of the offered ids, or 'new' for a separate account. */
  memberId: z.union([z.literal('new'), objectId]).optional(),
});

/** POST /api/member/auth/password — mobile number, email or member ID, and the password. */
export const memberPasswordSignInSchema = z.object({
  login: z.string().trim().min(1, 'Enter your mobile number, email or member ID').max(120),
  password: z.string().min(1, 'Enter your password').max(128),
  memberId: objectId.optional(),
});

/** POST /api/member/auth/password/change — rules for the new password are in memberPasswordService. */
export const changeMemberPasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(1, 'Enter a new password').max(128, 'Use at most 128 characters.'),
  confirmPassword: z.string().max(128),
});
