/**
 * UPI without a gateway: the member pays the gym's UPI ID from their own app, then sends us the
 * transaction reference (UTR). The due waits as "awaiting verification" until staff match it in
 * the bank app and confirm (collect with mode UPI) or reject it with a reason.
 */
import Payment from '../models/Payment.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { withTransaction } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { notifyMember } from './notify.js';
import { assertUtrUnused, buildUpiLink, collectDue, roundMoney } from './paymentService.js';
import { notifyMembershipActivated, paymentTypeLabel, sendReceipt } from './receiptService.js';
import './emailTemplates/paymentTemplates.js';

/** What the member app needs to open a UPI app (or show a QR) for one of the member's dues. */
export async function upiIntentForDue({ memberId, dueId }) {
  const [settings, due] = await Promise.all([getSettingsDoc(), Payment.findOne({ _id: dueId, memberId }).populate('membershipId', 'planName').lean()]);
  if (!due) throw new AppError('Bill not found', 404, 'NOT_FOUND');
  if (due.status === 'paid') throw new AppError('This bill is already paid', 409, 'ALREADY_PAID');
  if (due.status !== 'pending') throw new AppError('This bill was cancelled, so there is nothing to pay', 409, 'NOT_DUE');

  const { upiId, payeeName, acceptUpi } = settings.payments || {};
  if (!upiId || acceptUpi === false) {
    throw new AppError('The gym has not set up UPI payments yet. Pay at the front desk.', 409, 'UPI_NOT_SET_UP');
  }
  const amount = roundMoney(due.amount);
  const note = `${settings.gymName || 'Gym'} ${due.invoiceNo}`.trim();
  const name = payeeName || settings.gymName || '';
  return {
    link: buildUpiLink({ upiId, payeeName: name, amount, note }),
    upiId,
    payeeName: name,
    amount,
    currency: 'INR',
    note,
    reference: due.invoiceNo,
    forLabel: due.membershipId?.planName ? `${paymentTypeLabel(due.type)}: ${due.membershipId.planName}` : paymentTypeLabel(due.type),
    awaitingVerification: due.verification?.state === 'submitted',
  };
}

/**
 * Staff decision on a member's UPI reference.
 *   confirm: collects the due (all of it, or `amount` if the member paid part) with mode UPI
 *   reject:  the due stays owed; the member is told why
 * @returns {{ decision, payment, due, activatedMembership }}
 */
export async function reviewUpiReference(dueId, { decision, reason, amount }, staff) {
  const settings = await getSettingsDoc();

  if (decision === 'reject') {
    const due = await Payment.findOneAndUpdate(
      { _id: dueId, status: 'pending', 'verification.state': 'submitted' },
      { $set: { 'verification.state': 'rejected', 'verification.reason': reason, 'verification.reviewedAt': new Date(), 'verification.reviewedBy': staff.id } },
      { new: true }
    );
    if (!due) await explainNothingToVerify(dueId);
    notifyMember({
      memberId: due.memberId,
      kind: 'payment_verification',
      title: "We couldn't confirm your UPI payment",
      body: `Reference ${due.verification.utr}: ${reason}`,
      link: '/member/payments',
      email: {
        templateKey: 'upiReferenceRejected',
        vars: { amount: due.verification.amount ?? due.amount, utr: due.verification.utr, reason, invoiceNo: due.invoiceNo, gymName: settings.gymName },
      },
      dedupeKey: `upi-rejected:${due._id}:${due.verification.utr}`,
      createdBy: staff.id,
    }).catch((e) => logger.warn(`UPI rejection notice failed for ${due._id}: ${e.message}`));
    return { decision, payment: null, due, activatedMembership: null };
  }

  const result = await withTransaction(async (session) => {
    const due = await Payment.findById(dueId).session(session);
    if (!due || due.status !== 'pending' || due.verification?.state !== 'submitted') return { missing: true };
    const utr = due.verification.utr;
    await assertUtrUnused(utr, due._id);
    const collected = await collectDue(
      due._id,
      {
        amount,
        mode: 'upi',
        txnRef: utr,
        recordedBy: staff.id,
        allowPartial: settings.payments?.allowPartial !== false,
        invoicePrefix: settings.invoicePrefix,
      },
      session
    );
    await Payment.updateOne(
      { _id: due._id },
      { $set: { 'verification.state': 'confirmed', 'verification.reviewedAt': new Date(), 'verification.reviewedBy': staff.id } },
      { session }
    );
    return collected;
  });
  if (result.missing) await explainNothingToVerify(dueId);

  sendReceipt(result.payment._id, { auto: true, createdBy: staff.id }).catch((e) => logger.warn(`UPI receipt failed for ${result.payment._id}: ${e.message}`));
  notifyMembershipActivated(result.activatedMembership, { createdBy: staff.id }).catch((e) => logger.warn(`Activation notice failed: ${e.message}`));
  const due = await Payment.findById(dueId).lean();
  return { decision, payment: result.payment, due, activatedMembership: result.activatedMembership };
}

async function explainNothingToVerify(dueId) {
  const due = await Payment.findById(dueId).lean();
  if (!due) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  if (due.status === 'paid') throw new AppError('This bill was already collected', 409, 'ALREADY_PAID');
  throw new AppError('There is no UPI reference waiting to be checked on this bill', 409, 'NOTHING_TO_VERIFY');
}
