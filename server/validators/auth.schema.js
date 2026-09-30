import { z } from 'zod';
import { objectId } from './common.js';

/** Any Firebase sign-in (Google, email/password, phone OTP) exchanged for a member session. */
export const memberSessionSchema = z.object({
  idToken: z.string().min(10, 'idToken is required').max(8000),
  /** For a new account when the sign-in has no name (phone, email). */
  name: z.string().trim().max(120).optional(),
  /** Answer to CHOOSE_MEMBER: one of the offered ids, or 'new' for a separate account. */
  memberId: z.union([z.literal('new'), objectId]).optional(),
});
