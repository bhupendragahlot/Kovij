import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { collectPendingPayment, createPayment, findByIdempotencyKey } from '../services/paymentService.js';
import { memberSearchFilter } from '../services/memberService.js';
import { renderReceiptHtml } from '../services/receiptService.js';
import { withTransaction } from '../utils/db.js';
import { escapeRegex } from '../utils/strings.js';
import { endOfGymDay, parseGymDay } from '../utils/time.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const canSeeRevenue = (req) => ['admin', 'manager'].includes(req.staffUser.role);

/** GET /api/admin/payments */
export const listPayments = asyncHandler(async (req, res) => {
  const { status, mode, from, to, q, memberId, page, limit } = req.validated.query;
  const filter = {};
  if (status !== 'all') filter.status = status;
  if (mode) filter.mode = mode;
  if (memberId) filter.memberId = memberId;

  // Dues are listed by when they were raised; paid rows by when the money came in.
  const dateField = status === 'paid' ? 'paidAt' : 'createdAt';
  if (from || to) {
    filter[dateField] = {};
    if (from) filter[dateField].$gte = parseGymDay(from).startOf('day').toDate();
    if (to) filter[dateField].$lte = endOfGymDay(parseGymDay(to).toDate());
  }

  if (q) {
    const memberIds = await Member.find(memberSearchFilter(q)).distinct('_id');
    filter.$or = [{ memberId: { $in: memberIds } }, { invoiceNo: new RegExp(escapeRegex(q), 'i') }];
  }

  const sort = status === 'pending' ? { createdAt: 1 } : { [dateField]: -1, createdAt: -1 };
  const [payments, total, totals] = await Promise.all([
    Payment.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('memberId', 'name phone memberCode profilePhoto')
      .populate('membershipId', 'planName status')
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: filter }, { $group: { _id: '$status', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);

  const byStatus = Object.fromEntries(totals.map((t) => [t._id, { amount: t.amount, count: t.count }]));
  res.json({
    success: true,
    payments,
    total,
    page,
    limit,
    totals: {
      pending: byStatus.pending || { amount: 0, count: 0 },
      ...(canSeeRevenue(req) && { paid: byStatus.paid || { amount: 0, count: 0 } }),
    },
  });
});

/** POST /api/admin/payments — money received at the desk (idempotent). */
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
  const payment = await withTransaction((session) =>
    createPayment(
      { ...body, status: 'paid', recordedBy: req.staffUser.id, idempotencyKey: req.idempotencyKey },
      { session, invoicePrefix: settings.invoicePrefix }
    )
  );
  res.status(201).json({ success: true, payment });
});

/** POST /api/admin/payments/:id/collect — settle a pending due (idempotent). */
export const collectPayment = asyncHandler(async (req, res) => {
  const { mode, txnRef } = req.validated.body;
  const settings = await getSettingsDoc();
  const { payment, activatedMembership } = await withTransaction((session) =>
    collectPendingPayment(req.params.id, { mode, txnRef, recordedBy: req.staffUser.id }, session)
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
  res.json({ success: true, payment, activatedMembership });
});

async function loadReceipt(paymentId) {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  const [member, membership, settings] = await Promise.all([
    Member.findById(payment.memberId).lean(),
    payment.membershipId ? Membership.findById(payment.membershipId).select('planName').lean() : null,
    getSettingsDoc(),
  ]);
  return { payment, member, settings, html: renderReceiptHtml({ payment, member, settings, planName: membership?.planName }) };
}

/** GET /api/admin/payments/:id/receipt — printable HTML. */
export const getReceipt = asyncHandler(async (req, res) => {
  const { html } = await loadReceipt(req.params.id);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(html);
});

/** POST /api/admin/payments/:id/send-receipt */
export const sendReceiptEmail = asyncHandler(async (req, res) => {
  const { payment, member, settings, html } = await loadReceipt(req.params.id);
  if (!member?.email) throw new AppError('This member has no email address', 422, 'NO_EMAIL');
  await queueEmail({
    to: member.email,
    templateKey: 'paymentBill',
    vars: { name: member.name, invoiceNo: payment.invoiceNo, receiptHtml: html, gymName: settings.gymName },
  });
  res.json({ success: true, message: `Receipt emailed to ${member.email}` });
});
