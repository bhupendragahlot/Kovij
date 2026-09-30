import { z } from 'zod';
import { dayKey, money, objectId, optionalText, pagination, paymentMode } from './common.js';

export const listPaymentsQuery = z.object({
  status: z.enum(['all', 'paid', 'pending', 'failed']).default('all'),
  mode: paymentMode.optional(),
  from: dayKey.optional(),
  to: dayKey.optional(),
  q: optionalText(100),
  memberId: objectId.optional(),
  ...pagination,
});

/** Staff records money received at the desk. Always "paid": dues are created by sales. */
export const recordPaymentSchema = z.object({
  memberId: objectId,
  membershipId: objectId.optional(),
  type: z.enum(['registration', 'membership', 'renewal', 'personal_training', 'other']),
  amount: money.refine((n) => n > 0, 'Amount must be more than 0'),
  mode: paymentMode,
  txnRef: optionalText(80),
  note: optionalText(300),
});

export const collectPaymentSchema = z.object({
  mode: paymentMode,
  txnRef: optionalText(80),
});
