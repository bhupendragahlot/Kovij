import Payment from '../models/Payment.js';
import { nextSequence } from '../models/Counter.js';
import { AppError } from '../middleware/errorHandler.js';
import { endOfGymDay, parseGymDay, toGymTime } from '../utils/time.js';
import { toObjectId } from '../utils/db.js';
import { activateIfSettled } from './membershipService.js';

/** Money is stored in rupees with at most two decimals (paise). */
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100;

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

/** Desk payment modes and the settings flag that turns each one on. */
const MODE_FLAGS = { cash: 'acceptCash', upi: 'acceptUpi', card: 'acceptCard' };
const MODE_NAMES = { cash: 'Cash', upi: 'UPI', card: 'Card' };

/** Modes the desk may take today, from settings.payments (missing flags count as on). */
export function acceptedDeskModes(payments = {}) {
  return Object.keys(MODE_FLAGS).filter((mode) => payments?.[MODE_FLAGS[mode]] !== false);
}

export function assertModeAccepted(settings, mode) {
  if (!MODE_FLAGS[mode]) return;
  if (!acceptedDeskModes(settings?.payments).includes(mode)) {
    throw new AppError(`${MODE_NAMES[mode]} payments are turned off in Settings. Choose another way to pay.`, 422, 'MODE_NOT_ACCEPTED', {
      fields: { mode: `${MODE_NAMES[mode]} is turned off in Settings` },
    });
  }
}

/**
 * How a collection is applied to a due. Pure, so the money rules are unit-tested.
 *   full     the due itself becomes paid (it keeps its receipt number)
 *   partial  a new paid row takes `amount`; the due keeps `balance` owed
 * `amount` omitted means "the whole due".
 */
export function planCollection({ due, amount, allowPartial }) {
  const owed = roundMoney(due);
  const take = amount == null ? owed : roundMoney(amount);
  if (!(take > 0)) {
    throw new AppError('Enter an amount more than ₹0', 422, 'VALIDATION_ERROR', { fields: { amount: 'Enter an amount more than 0' } });
  }
  if (take > owed) {
    throw new AppError(`Only ${inr(owed)} is due. Enter ${inr(owed)} or less.`, 422, 'AMOUNT_TOO_HIGH', {
      fields: { amount: `Only ${inr(owed)} is due` },
    });
  }
  if (take === owed) return { kind: 'full', amount: owed, balance: 0 };
  if (!allowPartial) {
    throw new AppError('Part payments are turned off. Collect the full amount, or turn on part payments in Settings.', 422, 'PARTIAL_NOT_ALLOWED', {
      fields: { amount: `Collect the full ${inr(owed)}` },
    });
  }
  return { kind: 'partial', amount: take, balance: roundMoney(owed - take) };
}

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
 * Collect all or part of a pending due, inside the caller's transaction.
 *  - full: the due is marked paid; its membership activates once nothing is owed.
 *  - partial: a new paid row (own receipt number) is created and the due's amount drops.
 * `gateway` is attached to whichever row records the money (unique per gateway payment id).
 * @returns {{ payment, due, activatedMembership, partial: boolean }}
 */
export async function collectDue(paymentId, { amount, mode, txnRef, recordedBy, idempotencyKey, gateway, allowPartial = true, invoicePrefix }, session) {
  const due = await Payment.findById(paymentId).session(session);
  if (!due) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  if (due.status === 'paid') {
    throw new AppError('This payment was already collected', 409, 'ALREADY_PAID', { paymentId: String(due._id) });
  }
  if (due.status !== 'pending') {
    throw new AppError('This bill was cancelled or refunded, so there is nothing to collect', 409, 'NOT_DUE', { paymentId: String(due._id) });
  }

  const plan = planCollection({ due: due.amount, amount, allowPartial });

  if (plan.kind === 'full') {
    due.status = 'paid';
    due.mode = mode;
    due.txnRef = txnRef || '';
    due.paidAt = new Date();
    due.recordedBy = recordedBy;
    if (due.originalAmount != null) due.balanceAfter = 0;
    if (gateway) due.gateway = gateway;
    await due.save({ session });
    const activatedMembership = await activateIfSettled(due.membershipId, session);
    return { payment: due, due: null, activatedMembership, partial: false };
  }

  const part = await createPayment(
    {
      memberId: due.memberId,
      membershipId: due.membershipId,
      type: due.type,
      amount: plan.amount,
      status: 'paid',
      mode,
      txnRef: txnRef || '',
      recordedBy,
      idempotencyKey,
      dueId: due._id,
      balanceAfter: plan.balance,
      ...(gateway && { gateway }),
    },
    { session, invoicePrefix }
  );
  if (due.originalAmount == null) due.originalAmount = due.amount;
  due.amount = plan.balance;
  await due.save({ session });
  return { payment: part, due, activatedMembership: null, partial: true };
}

/**
 * Mark a pending due as paid in full and activate the membership it belongs to once nothing is owed.
 * Kept for callers that always settle the whole due.
 * @returns {{ payment, activatedMembership }}
 */
export async function collectPendingPayment(paymentId, { mode, txnRef, recordedBy }, session) {
  const { payment, activatedMembership } = await collectDue(paymentId, { mode, txnRef, recordedBy }, session);
  return { payment, activatedMembership };
}

/**
 * Record that money for a paid payment was given back by hand. The payment stops counting as
 * revenue (status `refunded`). Memberships are not touched: cancelling a plan is a separate step.
 */
export async function refundPayment(paymentId, { reason, by }) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  if (payment.status === 'refunded') {
    throw new AppError('This payment was already refunded', 409, 'ALREADY_REFUNDED', { paymentId: String(payment._id) });
  }
  if (payment.status !== 'paid') throw new AppError('Only paid payments can be refunded', 409, 'NOT_PAID');
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: 'paid' },
    { $set: { status: 'refunded', refund: { amount: payment.amount, reason, at: new Date(), by } } },
    { new: true }
  );
  if (!updated) throw new AppError('This payment was already refunded', 409, 'ALREADY_REFUNDED', { paymentId: String(payment._id) });
  return updated;
}

/** Day range (gym time) for list filters. */
function dayRange(from, to) {
  const range = {};
  if (from) range.$gte = parseGymDay(from).startOf('day').toDate();
  if (to) range.$lte = endOfGymDay(parseGymDay(to).toDate());
  return Object.keys(range).length ? range : null;
}

/**
 * Filter + sort for the staff payment list and CSV export. Pure.
 *   status  all | paid | pending | awaiting (UPI reference to check) | refunded | failed
 * Dates apply to when money came in for paid rows, when a refund was made for refunded rows,
 * and when the bill was raised for dues.
 */
export function buildPaymentFilter({ status = 'all', mode, type, from, to, memberId } = {}) {
  const and = [];
  if (status === 'awaiting') and.push({ status: 'pending', 'verification.state': 'submitted' });
  else if (status !== 'all') and.push({ status });
  if (mode) and.push({ mode });
  if (type) and.push({ type });
  if (memberId) and.push({ memberId: toObjectId(memberId) });

  const range = dayRange(from, to);
  const dateField = status === 'paid' ? 'paidAt' : status === 'refunded' ? 'refund.at' : 'createdAt';
  if (range) {
    if (status === 'all') and.push({ $or: [{ paidAt: range }, { paidAt: { $exists: false }, createdAt: range }] });
    else and.push({ [dateField]: range });
  }

  const sort = status === 'pending' || status === 'awaiting' ? { createdAt: 1 } : status === 'all' ? { createdAt: -1 } : { [dateField]: -1, createdAt: -1 };
  return { filter: and.length ? { $and: and } : {}, sort, dateField };
}

/**
 * A `upi://pay` link any UPI app understands. Only standard parameters are used; `tr` is left
 * out because some apps refuse it for personal (non-merchant) UPI IDs.
 */
export function buildUpiLink({ upiId, payeeName, amount, note }) {
  const enc = encodeURIComponent;
  const parts = [`pa=${enc(upiId)}`];
  if (payeeName) parts.push(`pn=${enc(payeeName)}`);
  parts.push(`am=${roundMoney(amount).toFixed(2)}`, 'cu=INR');
  if (note) parts.push(`tn=${enc(String(note).slice(0, 60))}`);
  return `upi://pay?${parts.join('&')}`;
}

/** UPI apps show the reference as 12 digits (UTR/RRN) or an app id such as T2409…; keep letters and digits. */
export function normalizeUtr(value) {
  return String(value || '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
}

/** Throws if this UPI reference already paid another bill (typo or reused screenshot). */
export async function assertUtrUnused(utr, exceptPaymentId) {
  const clash = await Payment.exists({
    _id: { $ne: exceptPaymentId },
    $or: [
      { 'verification.utr': utr, 'verification.state': 'submitted' },
      { mode: 'upi', txnRef: utr, status: { $in: ['paid', 'refunded'] } },
    ],
  });
  if (clash) {
    throw new AppError('This UPI reference was already used for another payment. Check the number and try again.', 409, 'UTR_ALREADY_USED', {
      fields: { utr: 'Already used for another payment' },
    });
  }
}

/** Member says they paid a due by UPI: park it for staff to check. Idempotent for the same reference. */
export async function submitUpiReference({ memberId, dueId, utr }) {
  const due = await Payment.findOne({ _id: dueId, memberId });
  if (!due) throw new AppError('Bill not found', 404, 'NOT_FOUND');
  if (due.status === 'paid') throw new AppError('This bill is already paid', 409, 'ALREADY_PAID');
  if (due.status !== 'pending') throw new AppError('This bill was cancelled, so there is nothing to pay', 409, 'NOT_DUE');

  const ref = normalizeUtr(utr);
  if (due.verification?.state === 'submitted') {
    if (due.verification.utr === ref) return due;
    throw new AppError('You already sent a UPI reference for this bill. The gym will check it soon.', 409, 'ALREADY_SUBMITTED');
  }
  await assertUtrUnused(ref, due._id);

  const updated = await Payment.findOneAndUpdate(
    { _id: due._id, status: 'pending', 'verification.state': { $ne: 'submitted' } },
    { $set: { verification: { state: 'submitted', utr: ref, amount: due.amount, submittedAt: new Date() } } },
    { new: true }
  );
  if (!updated) throw new AppError('You already sent a UPI reference for this bill. The gym will check it soon.', 409, 'ALREADY_SUBMITTED');
  return updated;
}
