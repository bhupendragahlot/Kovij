import { z } from 'zod';
import { objectId, optionalEmail, optionalText, pagination } from './common.js';

const status = z.enum(['new', 'contacted', 'trial', 'won', 'lost']);
const source = z.enum(['walk_in', 'phone', 'website', 'instagram', 'referral', 'other']);

export const listLeadsQuery = z.object({
  status: z.union([status, z.literal('open'), z.literal('all')]).default('open'),
  due: z.enum(['today', 'overdue']).optional(),
  /** Likely-spam leads are hidden by default; `only` lists just them for review. */
  spam: z.enum(['hide', 'only']).default('hide'),
  q: optionalText(100),
  ...pagination,
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: optionalText(20),
  email: optionalEmail,
  source: source.default('walk_in'),
  interestPlanId: objectId.optional(),
  nextFollowUpAt: z.coerce.date().optional(),
  note: optionalText(2000),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: optionalText(20),
  email: optionalEmail,
  source: source.optional(),
  status: status.optional(),
  interestPlanId: objectId.nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
  lostReason: optionalText(300),
  spam: z.boolean().optional(),
});

export const leadNoteSchema = z.object({ text: z.string().trim().min(1, 'Write a note').max(2000) });
