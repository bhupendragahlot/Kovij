import { z } from 'zod';
import { dayKey, pagination } from './common.js';

const days = z.coerce.number().int().min(7, 'At least 7 days').max(90, 'At most 90 days').default(14);

export const reportPeriodQuery = z.object({
  from: dayKey.optional(),
  to: dayKey.optional(),
  days,
});

export const notComingInQuery = z.object({ days, ...pagination });
