import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { renderReceiptHtml } from '../services/receiptService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

/** GET /api/payments/me */
export const listMine = asyncHandler(async (req, res) => {
  const list = await Payment.find({ memberId: req.member.memberId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, payments: list });
});

/** GET /api/payments/:id/bill — a member's own receipt (HTML, or JSON with ?format=json). */
export const getBill = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).lean();
  if (!payment || String(payment.memberId) !== String(req.member.memberId)) {
    throw new AppError('Payment not found', 404, 'NOT_FOUND');
  }

  const [member, membership, settings] = await Promise.all([
    Member.findById(payment.memberId).lean(),
    payment.membershipId ? Membership.findById(payment.membershipId).select('planName').lean() : null,
    getSettingsDoc(),
  ]);
  const html = renderReceiptHtml({ member, payment, settings, planName: membership?.planName });

  if (req.query.format === 'json') {
    return res.json({ success: true, invoiceNo: payment.invoiceNo, html });
  }

  if (req.query.emailCopy === '1' || req.query.emailCopy === 'true') {
    queueEmail({
      to: member.email,
      templateKey: 'paymentBill',
      vars: { name: member.name, invoiceNo: payment.invoiceNo, receiptHtml: html, gymName: settings.gymName },
    }).catch(() => {});
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(html);
});
