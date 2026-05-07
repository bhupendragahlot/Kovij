import { z } from 'zod';

export const recordPaymentSchema = z.object({
  membershipId: z.string().optional(),
  type: z.enum(['registration', 'membership', 'renewal']),
  amount: z.coerce.number().min(0),
  mode: z.enum(['cash', 'upi', 'card']),
  status: z.enum(['paid', 'pending', 'failed']).optional().default('pending'),
  txnRef: z.string().optional(),
});
