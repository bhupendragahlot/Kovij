import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

export const recordPayment = asyncHandler(async (req, res) => {
  const body = req.validated?.body ?? req.body;
  const memberId = req.member.memberId;

  const payment = await Payment.create({
    memberId,
    membershipId: body.membershipId || undefined,
    type: body.type,
    amount: body.amount,
    mode: body.mode,
    status: body.status,
    txnRef: body.txnRef || '',
    paidAt: body.status === 'paid' ? new Date() : undefined,
  });

  res.status(201).json({ success: true, payment });
});

export const listMine = asyncHandler(async (req, res) => {
  const list = await Payment.find({ memberId: req.member.memberId }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, payments: list });
});

function billHtml(member, payment, items) {
  const toIstDdMmYyyyHm = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    try {
      const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
      const time = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
      return `${date} ${time}`;
    } catch {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = String(d.getFullYear());
      return `${dd}/${mm}/${yyyy}`;
    }
  };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${payment.invoiceNo}</title></head><body style="font-family:system-ui">
    <h1>${payment.invoiceNo}</h1>
    <p><strong>Bill to:</strong> ${member.name} &lt;${member.email}&gt;</p>
    <p><strong>Date:</strong> ${toIstDdMmYyyyHm(payment.paidAt || payment.createdAt || new Date())}</p>
    <table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
    ${items.map((i) => `<tr><td>${i.label}</td><td>${i.amount}</td></tr>`).join('')}
    </tbody></table>
    <p><strong>Total:</strong> ${payment.amount}</p>
    <p><strong>Mode:</strong> ${payment.mode} | <strong>Status:</strong> ${payment.status}</p>
  </body></html>`;
}

export const getBill = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw new AppError('Payment not found', 404, 'NOT_FOUND');

  const isOwner = String(payment.memberId) === String(req.member.memberId);
  if (!isOwner) throw new AppError('Forbidden', 403, 'FORBIDDEN');

  const member = await Member.findById(payment.memberId).lean();
  const items = [{ label: payment.type, amount: payment.amount }];
  const html = billHtml(member, payment, items);

  const wantsJson = req.query.format === 'json';
  if (wantsJson) {
    return res.json({ success: true, invoiceNo: payment.invoiceNo, html });
  }

  if (req.query.emailCopy === '1' || req.query.emailCopy === 'true') {
    queueEmail({
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
    }).catch(() => {});
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
