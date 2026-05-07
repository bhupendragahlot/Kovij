import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

export const sendBillEmail = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.paymentId);
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');
  const member = await Member.findById(payment.memberId).lean();
  if (!member?.email) throw new AppError('Member email missing', 400, 'BAD_REQUEST');

  const items = [{ label: payment.type, amount: payment.amount }];
  await queueEmail({
    to: member.email,
    templateKey: 'paymentBill',
    vars: {
      name: member.name,
      invoiceNo: payment.invoiceNo,
      billDate: payment.paidAt || payment.createdAt || new Date(),
      amount: String(payment.amount),
      mode: payment.mode,
      status: payment.status,
      itemsHtml: items.map((i) => `<tr><td>${i.label}</td><td>${i.amount}</td></tr>`).join(''),
    },
  });

  res.json({ success: true, message: 'Bill email queued' });
});
