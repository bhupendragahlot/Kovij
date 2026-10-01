import { z } from 'zod';
import { dayKey, objectId, pagination } from './common.js';

const range = (v) => !v.from || !v.to || v.from <= v.to;
const rangeError = { message: 'The start date must be before the end date', path: ['to'] };

export const activityQuery = z
  .object({
    actorId: objectId.optional(),
    memberId: objectId.optional(),
    kind: z.enum(['create', 'update', 'delete', 'other']).optional(),
    entityType: z.string().trim().regex(/^[a-z-]{2,40}$/).optional(),
    outcome: z.enum(['all', 'ok', 'failed']).default('all'),
    from: dayKey.optional(),
    to: dayKey.optional(),
    ...pagination,
  })
  .refine(range, rangeError);

export const signInQuery = z
  .object({
    userId: objectId.optional(),
    outcome: z.enum(['all', 'ok', 'failed']).default('all'),
    from: dayKey.optional(),
    to: dayKey.optional(),
    ...pagination,
  })
  .refine(range, rangeError);
