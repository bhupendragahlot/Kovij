import Payment from '../models/Payment.js';
import { nextSequence } from '../models/Counter.js';
import { AppError } from '../middleware/errorHandler.js';
import { toGymTime } from '../utils/time.js';
import { activateIfSettled } from './membershipService.js';

/** Sequential, per-year invoice numbers, e.g. KFZ-2026-00042. */
export async function allocateInvoiceNo(prefix, session) {
  const year = toGymTime().format('YYYY');
  const seq = await nextSequence(`invoice:${year}`, session);
  return `${prefix || 'KFZ'}-${year}-${String(seq).padStart(5, '0')}`;
}

/**
 * Create a payment (paid or pending due). Every payment in the system is created here so
 * numbering, timestamps and the idempotency backstop behave the same everywhere.
 */
export async function createPayment(data, { session, invoicePrefix }) {
  const invoiceNo = await allocateInvoiceNo(invoicePrefix, session);
  const paid = data.status === 'paid';
  const [payment] = await Payment.create(
    [
      {
        ...data,
        invoiceNo,
        mode: paid ? data.mode : data.mode || undefined,
        paidAt: paid ? new Date() : undefined,
      },
    ],
    { session }
  );
  return payment;
}

/** DB-level guard: if a payment already exists for this Idempotency-Key, return it. */
export async function findByIdempotencyKey(key) {
  if (!key) return null;
  return Payment.findOne({ idempotencyKey: key });
}

/**
 * Mark a pending due as paid and activate the membership it belongs to once nothing is owed.
 * @returns {{ payment, activatedMembership }}
 */
export async function collectPendingPayment(paymentId, { mode, txnRef, recordedBy }, session) {
  const payment = await Payment.findById(paymentId).session(session);
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  if (payment.status === 'paid') {
    throw new AppError('This payment was already collected', 409, 'ALREADY_PAID', { paymentId: String(payment._id) });
  }
  payment.status = 'paid';
  payment.mode = mode;
  payment.txnRef = txnRef || '';
  payment.paidAt = new Date();
  payment.recordedBy = recordedBy;
  await payment.save({ session });

  const activatedMembership = await activateIfSettled(payment.membershipId, session);
  return { payment, activatedMembership };
}
