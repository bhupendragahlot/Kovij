import { z } from 'zod';
import { objectId, optionalText, pagination } from './common.js';
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '../models/SupportTicket.js';

const message = z.string().trim().min(2, 'Write a message').max(4000, 'Keep it under 4,000 characters');

export const createTicketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES).default('other'),
  subject: z.string().trim().min(3, 'Add a short subject').max(140, 'Keep the subject under 140 characters'),
  message,
});

export const replySchema = z.object({ text: message });

export const staffReplySchema = z.object({
  text: message,
  /** Optionally close the loop in the same step. */
  status: z.enum(['waiting_member', 'resolved']).optional(),
});

export const staffUpdateSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    assignedTo: z.union([objectId, z.literal(''), z.null()]).optional(),
    category: z.enum(SUPPORT_CATEGORIES).optional(),
  })
  .refine((v) => v.status || v.assignedTo !== undefined || v.category, { message: 'Nothing to change' });

export const staffListQuery = z.object({
  status: z.enum(['active', 'all', ...SUPPORT_STATUSES]).default('active'),
  assigned: z.enum(['me', 'none', 'any']).default('any'),
  q: optionalText(100),
  ...pagination,
});
