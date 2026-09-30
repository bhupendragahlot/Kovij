import Payment from '../models/Payment.js';
import { loadReceipt, sendReceipt } from '../services/receiptService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Legacy member endpoints (/api/payments) used by the current member portal.
 * The member app uses /api/member/payments (memberPaymentController.js).
 */

/** GET /api/payments/me */
export const listMine = asyncHandler(async (req, res) => {
  const list = await Payment.find({ memberId: req.member.memberId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, payments: list });
});

/** GET /api/payments/:id/bill: a member's own receipt (HTML, or JSON with ?format=json). */
export const getBill = asyncHandler(async (req, res) => {
  const { payment, html } = await loadReceipt(req.params.id, { memberId: req.member.memberId });

  if (req.query.format === 'json') {
    return res.json({ success: true, invoiceNo: payment.invoiceNo, html });
  }

  if ((req.query.emailCopy === '1' || req.query.emailCopy === 'true') && ['paid', 'refunded'].includes(payment.status)) {
    sendReceipt(payment._id, { memberId: req.member.memberId }).catch((e) => logger.warn(`Receipt copy failed for ${payment._id}: ${e.message}`));
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(html);
});
