import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { getSettingsDoc } from '../models/Settings.js';
import { can } from '../config/permissions.js';
import { queueEmail } from '../services/emailService.js';
import {
  assertModeAccepted,
  buildPaymentFilter,
  collectDue,
  createPayment,
  findByIdempotencyKey,
  refundPayment,
  roundMoney,
} from '../services/paymentService.js';
import { memberSearchFilter } from '../services/memberService.js';
import { loadReceipt, paymentModeLabel, paymentTypeLabel, sendReceipt } from '../services/receiptService.js';
import { reviewUpiReference } from '../services/upiVerificationService.js';
import { publicGatewayStatus } from '../services/onlinePaymentService.js';
import { sendCsv, toCsv } from '../services/csvExport.js';
import { withTransaction } from '../utils/db.js';
import { escapeRegex } from '../utils/strings.js';
import { toGymTime } from '../utils/time.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const canSeeRevenue = (req) => can(req.staffUser.role, 'revenue.view');
const EXPORT_LIMIT = 20_000;

/** Adds the free-text search (member or receipt number) to a built filter. */
async function withSearch(filter, q) {
  if (!q) return filter;
  const memberIds = await Member.find(memberSearchFilter(q)).distinct('_id');
  const search = { $or: [{ memberId: { $in: memberIds } }, { invoiceNo: new RegExp(escapeRegex(q), 'i') }, { txnRef: new RegExp(`^${escapeRegex(q)}$`, 'i') }] };
  return filter.$and ? { $and: [...filter.$and, search] } : search;
}

/** GET /api/admin/payments */
export const listPayments = asyncHandler(async (req, res) => {
  const { q, page, limit, ...filters } = req.validated.query;
  const built = buildPaymentFilter(filters);
  const filter = await withSearch(built.filter, q);
  const revenue = canSeeRevenue(req);

  const [payments, total, byStatus, byMode, awaiting] = await Promise.all([
    Payment.find(filter)
      .sort(built.sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('memberId', 'name phone memberCode profilePhoto')
      .populate('membershipId', 'planName status')
      .populate('dueId', 'invoiceNo')
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    revenue
      ? Payment.aggregate([{ $match: { $and: [filter, { status: 'paid' }] } }, { $group: { _id: '$mode', amount: { $sum: '$amount' }, count: { $sum: 1 } } }])
      : [],
    // The verify queue badge counts every waiting reference, whatever the current filters are.
    Payment.countDocuments({ status: 'pending', 'verification.state': 'submitted' }),
  ]);

  const totalsBy = Object.fromEntries(byStatus.map((t) => [t._id, { amount: roundMoney(t.amount), count: t.count }]));
  const zero = { amount: 0, count: 0 };
  res.json({
    success: true,
    payments,
    total,
    page,
    limit,
    totals: {
      pending: totalsBy.pending || zero,
      awaitingCount: awaiting,
      ...(revenue && {
        paid: totalsBy.paid || zero,
        refunded: totalsBy.refunded || zero,
        byMode: Object.fromEntries(['cash', 'upi', 'card', 'online'].map((m) => {
          const row = byMode.find((r) => r._id === m);
          return [m, row ? { amount: roundMoney(row.amount), count: row.count } : zero];
        })),
      }),
    },
  });
});

const STATUS_LABELS = { paid: 'Paid', pending: 'Due', failed: 'Cancelled', refunded: 'Refunded' };
const gymDateTime = (d) => (d ? toGymTime(d).format('YYYY-MM-DD HH:mm') : '');

/** GET /api/admin/payments/export.csv: the filtered list as a spreadsheet (every page). */
export const exportPayments = asyncHandler(async (req, res) => {
  const { q, ...filters } = req.validated.query;
  const built = buildPaymentFilter(filters);
  const filter = await withSearch(built.filter, q);
  const rows = await Payment.find(filter)
    .sort(built.sort)
    .limit(EXPORT_LIMIT)
    .populate('memberId', 'name phone memberCode')
    .populate('membershipId', 'planName')
    .populate('dueId', 'invoiceNo')
    .populate('recordedBy', 'name username')
    .lean();

  const csv = toCsv(
    [
      { header: 'Receipt no.', value: (p) => p.invoiceNo },
      { header: 'Status', value: (p) => (p.status === 'pending' && p.verification?.state === 'submitted' ? 'Due (UPI reference to check)' : STATUS_LABELS[p.status] || p.status) },
      { header: 'Member', value: (p) => p.memberId?.name || 'Deleted member' },
      { header: 'Member code', value: (p) => p.memberId?.memberCode },
      { header: 'Phone', value: (p) => p.memberId?.phone },
      { header: 'For', value: (p) => paymentTypeLabel(p.type) },
      { header: 'Plan', value: (p) => p.membershipId?.planName },
      { header: 'Amount (INR)', value: (p) => p.amount },
      { header: 'Mode', value: (p) => paymentModeLabel(p.mode) },
      { header: 'Reference', value: (p) => p.txnRef },
      { header: 'Raised on', value: (p) => gymDateTime(p.createdAt) },
      { header: 'Paid on', value: (p) => gymDateTime(p.paidAt) },
      { header: 'Part of bill', value: (p) => p.dueId?.invoiceNo },
      { header: 'Refunded on', value: (p) => gymDateTime(p.refund?.at) },
      { header: 'Refund reason', value: (p) => p.refund?.reason },
      { header: 'Recorded by', value: (p) => p.recordedBy?.name || p.recordedBy?.username },
      { header: 'Note', value: (p) => p.note },
    ],
    rows
  );
  if (rows.length >= EXPORT_LIMIT) res.setHeader('X-Export-Truncated', 'true');
  sendCsv(res, `payments-${toGymTime().format('YYYY-MM-DD')}.csv`, csv);
});

/** GET /api/admin/payments/:id: one payment with its part payments or the bill it belongs to. */
export const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('memberId', 'name phone memberCode profilePhoto email')
    .populate('membershipId', 'planName status')
    .populate('recordedBy', 'name username')
    .populate('refund.by', 'name username')
    .populate('verification.reviewedBy', 'name username')
    .lean();
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  const dueId = payment.dueId || payment._id;
  const [due, parts] = await Promise.all([
    payment.dueId ? Payment.findById(payment.dueId).select('invoiceNo amount originalAmount status createdAt').lean() : null,
    Payment.find({ dueId }).sort({ paidAt: 1 }).select('invoiceNo amount mode status paidAt balanceAfter txnRef').lean(),
  ]);
  res.json({ success: true, payment, due, parts });
});

/** POST /api/admin/payments: money received at the desk (idempotent). */
export const recordPayment = asyncHandler(async (req, res) => {
  const body = req.validated.body;

  const existing = await findByIdempotencyKey(req.idempotencyKey);
  if (existing) return res.status(200).json({ success: true, replayed: true, payment: existing });

  const member = await Member.findById(body.memberId).select('_id').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (body.membershipId && !(await Membership.exists({ _id: body.membershipId, memberId: body.memberId }))) {
    throw new AppError('That membership belongs to another member', 422, 'MEMBERSHIP_MISMATCH');
  }

  const settings = await getSettingsDoc();
  assertModeAccepted(settings, body.mode);
  const payment = await withTransaction((session) =>
    createPayment(
      { ...body, status: 'paid', recordedBy: req.staffUser.id, idempotencyKey: req.idempotencyKey },
      { session, invoicePrefix: settings.invoicePrefix }
    )
  );
  res.status(201).json({ success: true, payment });
});

/**
 * POST /api/admin/payments/:id/collect: settle all or part of a due (idempotent).
 * A part payment gets its own receipt; the rest stays due on the original bill.
 */
export const collectPayment = asyncHandler(async (req, res) => {
  const { mode, txnRef, amount } = req.validated.body;

  const existing = await findByIdempotencyKey(req.idempotencyKey);
  if (existing && String(existing.dueId) === String(req.params.id)) {
    return res.status(200).json({ success: true, replayed: true, payment: existing });
  }

  const settings = await getSettingsDoc();
  assertModeAccepted(settings, mode);
  const { payment, due, activatedMembership, partial } = await withTransaction((session) =>
    collectDue(
      req.params.id,
      {
        amount,
        mode,
        txnRef,
        recordedBy: req.staffUser.id,
        idempotencyKey: req.idempotencyKey,
        allowPartial: settings.payments?.allowPartial !== false,
        invoicePrefix: settings.invoicePrefix,
      },
      session
    )
  );

  if (activatedMembership) {
    const member = await Member.findById(payment.memberId).lean();
    queueEmail({
      to: member?.email,
      templateKey: 'welcome',
      vars: {
        name: member?.name,
        planName: activatedMembership.planName,
        startDate: activatedMembership.startDate,
        endDate: activatedMembership.endDate,
        gymName: settings.gymName,
      },
    }).catch(() => {});
  }
  res.json({ success: true, payment, due, partial, balance: due ? due.amount : 0, activatedMembership });
});

/** POST /api/admin/payments/:id/refund: money given back by hand (idempotent). */
export const refundPaymentHandler = asyncHandler(async (req, res) => {
  const payment = await refundPayment(req.params.id, { reason: req.validated.body.reason, by: req.staffUser.id });
  res.json({ success: true, payment });
});

/** POST /api/admin/payments/:id/verify: confirm or reject a member's UPI reference (idempotent). */
export const verifyPayment = asyncHandler(async (req, res) => {
  const result = await reviewUpiReference(req.params.id, req.validated.body, req.staffUser);
  res.json({ success: true, ...result });
});

/** GET /api/admin/payments/:id/receipt: printable HTML. */
export const getReceipt = asyncHandler(async (req, res) => {
  const { html } = await loadReceipt(req.params.id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(html);
});

/** POST /api/admin/payments/:id/send-receipt: email a copy to the member. */
export const sendReceiptEmail = asyncHandler(async (req, res) => {
  const result = await sendReceipt(req.params.id, { createdBy: req.staffUser.id });
  if (!result.emailed) {
    const reasons = {
      no_email: 'This member has no email address. Add one to their profile, or print the receipt.',
      opted_out: 'This member turned off emails from the gym. Print the receipt instead.',
    };
    throw new AppError(reasons[result.reason] || "The receipt couldn't be emailed. Try again, or print it.", 422, result.reason === 'no_email' ? 'NO_EMAIL' : 'EMAIL_NOT_SENT');
  }
  res.json({ success: true, message: `Receipt emailed to ${result.to}` });
});

/** GET /api/admin/payments/online-status: whether online payments can work (never the keys). */
export const onlineStatus = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  res.json({
    success: true,
    gateway: publicGatewayStatus(settings),
    upi: { ready: Boolean(settings.payments?.upiId) && settings.payments?.acceptUpi !== false },
  });
});
