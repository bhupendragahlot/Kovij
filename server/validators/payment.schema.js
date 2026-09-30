import { z } from 'zod';
import { dayKey, money, objectId, optionalText, pagination, paymentMode } from './common.js';

const paymentType = z.enum(['registration', 'membership', 'renewal', 'personal_training', 'other']);
/** Any recorded mode, including `online` (gateway), for filters. Desk forms use `paymentMode`. */
const anyMode = z.enum(['cash', 'upi', 'card', 'online']);
/** Query strings send "" for "any": treat it as not given. */
const blank = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema);
const positiveMoney = money.refine((n) => n > 0, 'Amount must be more than 0');

const paymentFilters = {
  status: blank(z.enum(['all', 'paid', 'pending', 'awaiting', 'refunded', 'failed']).default('all')),
  mode: blank(anyMode.optional()),
  type: blank(paymentType.optional()),
  from: blank(dayKey.optional()),
  to: blank(dayKey.optional()),
  q: optionalText(100),
  memberId: blank(objectId.optional()),
};
const fromBeforeTo = (v) => !v.from || !v.to || v.from <= v.to;
const fromBeforeToMessage = { message: 'The start date must be on or before the end date', path: ['from'] };

export const listPaymentsQuery = z.object({ ...paymentFilters, ...pagination }).refine(fromBeforeTo, fromBeforeToMessage);
export const exportPaymentsQuery = z.object(paymentFilters).refine(fromBeforeTo, fromBeforeToMessage);

/** Staff records money received at the desk. Always "paid": dues are created by sales. */
export const recordPaymentSchema = z.object({
  memberId: objectId,
  membershipId: objectId.optional(),
  type: paymentType,
  amount: positiveMoney,
  mode: paymentMode,
  txnRef: optionalText(80),
  note: optionalText(300),
});

/** Collect a due. Leave `amount` out to collect all of it; a smaller amount is a part payment. */
export const collectPaymentSchema = z.object({
  mode: paymentMode,
  txnRef: optionalText(80),
  amount: positiveMoney.optional(),
});

export const refundPaymentSchema = z.object({
  reason: z.string().trim().min(3, 'Say why the money was given back').max(300),
});

/** Staff decision on a member's UPI reference. */
export const verifyPaymentSchema = z
  .object({
    decision: z.enum(['confirm', 'reject']),
    reason: optionalText(300),
    amount: positiveMoney.optional(),
  })
  .refine((v) => v.decision !== 'reject' || (v.reason && v.reason.length >= 3), {
    message: 'Tell the member why, e.g. "No payment with this reference in the bank app"',
    path: ['reason'],
  });

export const financeQuery = z.object({
  month: blank(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM').optional()),
});

// ── Member app

export const memberPaymentsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** UTR: 12 digits on most UPI apps; some apps show an id with letters (e.g. T2409…). */
export const upiReferenceSchema = z.object({
  utr: z
    .string({ required_error: 'Enter the UPI reference number' })
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{8,35}$/, 'Enter the UPI reference (UTR) from your payment app, usually 12 digits')),
});

/** Exactly what Razorpay Checkout's success handler returns, passed straight through. */
export const onlineVerifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(64),
  razorpay_payment_id: z.string().trim().min(1).max(64),
  razorpay_signature: z.string().trim().regex(/^[a-fA-F0-9]{64}$/, 'Invalid payment signature'),
});
