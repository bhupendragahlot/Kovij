/**
 * Member app payments (/api/member/payments). A member only ever sees and acts on their own
 * payments; every lookup is scoped by req.member.memberId.
 */
import Payment from '../models/Payment.js';
import PaymentOrder from '../models/PaymentOrder.js';
import Member from '../models/Member.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { toObjectId } from '../utils/db.js';
import { roundMoney, submitUpiReference } from '../services/paymentService.js';
import { loadReceipt, paymentModeLabel, paymentTypeLabel, sendReceipt } from '../services/receiptService.js';
import { upiIntentForDue } from '../services/upiVerificationService.js';
import {
  fetchGatewayPayment,
  gatewayConfig,
  publicGatewayStatus,
  recordGatewayPayment,
  startOnlineOrder,
  verifyCheckoutSignature,
} from '../services/onlinePaymentService.js';

/** paid | due | awaiting_verification | refunded | cancelled */
export function memberStatus(p) {
  if (p.status === 'pending') return p.verification?.state === 'submitted' ? 'awaiting_verification' : 'due';
  if (p.status === 'failed') return 'cancelled';
  return p.status;
}

/** The one payment shape the member app receives. */
export function toMemberPayment(p) {
  const planName = p.membershipId?.planName || '';
  const status = memberStatus(p);
  const v = p.verification?.state ? p.verification : null;
  return {
    id: String(p._id),
    invoiceNo: p.invoiceNo,
    type: p.type,
    typeLabel: paymentTypeLabel(p.type),
    planName,
    forLabel: planName ? `${paymentTypeLabel(p.type)}: ${planName}` : paymentTypeLabel(p.type),
    amount: p.amount,
    status,
    mode: p.mode || null,
    modeLabel: paymentModeLabel(p.mode),
    txnRef: p.status === 'paid' || p.status === 'refunded' ? p.txnRef || '' : '',
    raisedAt: p.createdAt,
    paidAt: p.paidAt || null,
    // Part payments: a due that was part-paid shows the original bill; a part shows what was left.
    originalAmount: p.originalAmount ?? null,
    paidSoFar: p.originalAmount != null ? roundMoney(p.originalAmount - p.amount) : 0,
    isPartPayment: Boolean(p.dueId),
    balanceAfter: p.dueId ? p.balanceAfter ?? null : null,
    refund: p.status === 'refunded' && p.refund ? { amount: p.refund.amount ?? p.amount, reason: p.refund.reason || '', at: p.refund.at } : null,
    verification: v ? { state: v.state, utr: v.utr, submittedAt: v.submittedAt, reason: v.state === 'rejected' ? v.reason || '' : '' } : null,
    receiptAvailable: p.status === 'paid' || p.status === 'refunded',
  };
}

async function ownPayment(req) {
  const p = await Payment.findOne({ _id: req.params.id, memberId: req.member.memberId }).populate('membershipId', 'planName').lean();
  if (!p) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  return p;
}

/** GET /api/member/payments: money paid (and refunded), newest first. */
export const listMyPayments = asyncHandler(async (req, res) => {
  const { page, limit } = req.validated.query;
  const filter = { memberId: req.member.memberId, status: { $in: ['paid', 'refunded'] } };
  const [rows, total, sum] = await Promise.all([
    Payment.find(filter).sort({ paidAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('membershipId', 'planName').lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: { memberId: toObjectId(req.member.memberId), status: 'paid' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
  ]);
  res.json({ success: true, payments: rows.map(toMemberPayment), total, page, limit, totalPaid: roundMoney(sum[0]?.amount) });
});


/** GET /api/member/payments/dues: what the member still owes and how they can pay it. */
export const listMyDues = asyncHandler(async (req, res) => {
  const [rows, settings] = await Promise.all([
    Payment.find({ memberId: req.member.memberId, status: 'pending' }).sort({ createdAt: 1 }).populate('membershipId', 'planName').lean(),
    getSettingsDoc(),
  ]);
  const gateway = publicGatewayStatus(settings);
  const upiReady = Boolean(settings.payments?.upiId) && settings.payments?.acceptUpi !== false;
  res.json({
    success: true,
    dues: rows.map(toMemberPayment),
    count: rows.length,
    totalDue: roundMoney(rows.reduce((s, p) => s + p.amount, 0)),
    payOptions: {
      upi: { available: upiReady, upiId: upiReady ? settings.payments.upiId : '', payeeName: upiReady ? settings.payments.payeeName || settings.gymName : '' },
      online: { available: gateway.available, provider: gateway.provider },
      desk: { available: true },
    },
  });
});

/** GET /api/member/payments/:id */
export const getMyPayment = asyncHandler(async (req, res) => {
  res.json({ success: true, payment: toMemberPayment(await ownPayment(req)) });
});

/** GET /api/member/payments/:id/receipt: HTML (or { html } with ?format=json) for a paid payment. */
export const getMyReceipt = asyncHandler(async (req, res) => {
  const { payment, html } = await loadReceipt(req.params.id, { memberId: req.member.memberId });
  if (!['paid', 'refunded'].includes(payment.status)) throw new AppError("This bill isn't paid yet, so there is no receipt", 409, 'NOT_PAID');
  if (req.query.format === 'json') return res.json({ success: true, invoiceNo: payment.invoiceNo, html });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(html);
});

/** POST /api/member/payments/:id/email-receipt: email a copy of a receipt to the member. */
export const emailMyReceipt = asyncHandler(async (req, res) => {
  const result = await sendReceipt(req.params.id, { memberId: req.member.memberId });
  if (!result.emailed) {
    const message = result.reason === 'no_email' ? 'Add an email address to your profile first.' : 'Turn on emails in your notification settings first.';
    throw new AppError(message, 422, result.reason === 'no_email' ? 'NO_EMAIL' : 'EMAIL_NOT_SENT');
  }
  res.json({ success: true, message: `Receipt sent to ${result.to}` });
});

/** GET /api/member/payments/dues/:id/upi: a upi://pay link and the details for a QR code. */
export const getUpiIntent = asyncHandler(async (req, res) => {
  const upi = await upiIntentForDue({ memberId: req.member.memberId, dueId: req.params.id });
  res.json({ success: true, upi });
});

/** POST /api/member/payments/dues/:id/upi-reference: "I paid, here is the UTR" (idempotent). */
export const submitUpiRef = asyncHandler(async (req, res) => {
  const due = await submitUpiReference({ memberId: req.member.memberId, dueId: req.params.id, utr: req.validated.body.utr });
  const populated = await Payment.findById(due._id).populate('membershipId', 'planName').lean();
  res.json({ success: true, message: 'Thanks. The gym will check the payment and confirm it soon.', due: toMemberPayment(populated) });
});

/** POST /api/member/payments/dues/:id/online-order: start a card/UPI checkout (idempotent). */
export const createOnlineOrder = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.member.memberId).select('name email phone').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const result = await startOnlineOrder({ memberId: req.member.memberId, dueId: req.params.id, member });
  res.status(201).json({ success: true, ...result });
});

/**
 * POST /api/member/payments/online/verify: the checkout success callback.
 * Records the payment once the signature checks out and the gateway says it was captured.
 * Safe to call again: the same gateway payment is never recorded twice.
 */
export const verifyOnlinePayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId, razorpay_payment_id: gatewayPaymentId, razorpay_signature: signature } = req.validated.body;
  const cfg = gatewayConfig();
  if (!cfg.configured) {
    throw new AppError('Online payments are not set up at this gym yet. Pay by UPI or at the front desk.', 409, 'ONLINE_PAYMENTS_OFF');
  }
  if (!verifyCheckoutSignature({ orderId, paymentId: gatewayPaymentId, signature }, cfg.keySecret)) {
    throw new AppError("We couldn't confirm this payment. If money left your account, show it at the front desk.", 400, 'BAD_SIGNATURE');
  }
  const order = await PaymentOrder.findOne({ provider: 'razorpay', orderId }).lean();
  if (!order || String(order.memberId) !== String(req.member.memberId)) throw new AppError('Payment not found', 404, 'NOT_FOUND');

  const recorded = await Payment.findOne({ 'gateway.paymentId': gatewayPaymentId }).populate('membershipId', 'planName').lean();
  if (recorded) return res.json({ success: true, status: 'paid', replayed: true, payment: toMemberPayment(recorded) });

  const gp = await fetchGatewayPayment(gatewayPaymentId, cfg);
  if (gp.order_id && gp.order_id !== orderId) throw new AppError("We couldn't confirm this payment. Show it at the front desk.", 400, 'ORDER_MISMATCH');
  if (gp.status === 'authorized') {
    return res.status(202).json({ success: true, status: 'processing', message: 'Your bank approved the payment. It will show as paid in a few minutes.' });
  }
  if (gp.status !== 'captured') {
    throw new AppError("This payment didn't go through, so nothing was charged. Try again or pay at the desk.", 409, 'PAYMENT_NOT_COMPLETE');
  }

  const result = await recordGatewayPayment({ orderId, gatewayPaymentId, amountPaise: gp.amount, method: gp.method, source: 'checkout' });
  if (!result.replayed) {
    sendReceipt(result.payment._id, { auto: true }).catch((e) => logger.warn(`Online receipt failed for ${result.payment._id}: ${e.message}`));
  }
  const payment = await Payment.findById(result.payment._id).populate('membershipId', 'planName').lean();
  res.json({ success: true, status: 'paid', replayed: result.replayed, payment: toMemberPayment(payment), activatedMembership: Boolean(result.activatedMembership) });
});
