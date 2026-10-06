import Payment from '../models/Payment.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { escapeHtml } from '../utils/strings.js';
import { toGymTime } from '../utils/time.js';
import { BRAND_IMAGES, absoluteAppUrl } from '../utils/publicUrl.js';
import { notifyMember } from './notify.js';
import { waitForEmail } from './emailService.js';
import './emailTemplates/paymentTemplates.js';

const TYPE_LABELS = {
  registration: 'Registration fee',
  membership: 'Membership',
  renewal: 'Membership renewal',
  personal_training: 'Personal training',
  other: 'Other',
};
const MODE_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Online payment' };

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

export const paymentTypeLabel = (type) => TYPE_LABELS[type] || type;
export const paymentModeLabel = (mode) => MODE_LABELS[mode] || mode || '';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const threeDigits = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? twoDigits(n % 100) : ''].filter(Boolean).join(' ');

/** Whole rupees in the Indian system (thousand, lakh, crore). */
function rupeesInWords(n) {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  return [
    crore ? `${rupeesInWords(crore)} Crore` : '',
    lakh ? `${twoDigits(lakh)} Lakh` : '',
    thousand ? `${twoDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** 1500.5 → "Rupees One Thousand Five Hundred and Fifty Paise Only" (as printed on Indian receipts). */
export function amountInWords(amount) {
  const value = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(value / 100);
  const paise = value % 100;
  if (!rupees && paise) return `${twoDigits(paise)} Paise Only`;
  return `Rupees ${rupeesInWords(rupees)}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

const STATUS = {
  paid: { label: 'Paid', color: '#0e7a3c', bg: '#e2f5e8' },
  pending: { label: 'Due', color: '#8a5a00', bg: '#fff1d1' },
  refunded: { label: 'Refunded', color: '#474c54', bg: '#eceef1' },
  failed: { label: 'Cancelled', color: '#474c54', bg: '#eceef1' },
};

/**
 * Printable receipt (or bill, for a due). Self-contained HTML: prints on A4 or a phone screen,
 * and is also the body of the receipt email. Every interpolated value is escaped.
 * `due` is the bill a part payment was taken from (for "total bill" and "balance due").
 */
export function renderReceiptHtml({ member, payment, settings, planName, due }) {
  const gymName = settings?.gymName || 'Kovij Fitness Zone';
  // The gym's own logo when set (uploads are site paths), else the Kovij mark. Absolute: emailed receipts open outside the site.
  const logo = absoluteAppUrl(settings?.logoUrl) || absoluteAppUrl(BRAND_IMAGES.mark);
  const status = STATUS[payment.status] || STATUS.pending;
  const isDue = payment.status === 'pending';
  const title = isDue ? 'Bill' : payment.status === 'refunded' ? 'Receipt (refunded)' : 'Payment receipt';
  const when = toGymTime(payment.paidAt || payment.createdAt || new Date()).format('DD MMM YYYY, hh:mm A');
  const item = planName ? `${paymentTypeLabel(payment.type)}: ${planName}` : paymentTypeLabel(payment.type);
  const contact = [settings?.phone, settings?.email].filter(Boolean).join(' · ');

  const isPart = Boolean(payment.dueId);
  const totalBill = isPart ? due?.originalAmount ?? null : payment.originalAmount ?? null;
  const rows = [];
  if (isPart && totalBill != null) rows.push(['Total bill', inr(totalBill)]);
  if (isDue && payment.originalAmount != null) {
    rows.push(['Total bill', inr(payment.originalAmount)], ['Already paid', inr(payment.originalAmount - payment.amount)]);
  }

  const meta = [
    ['Receipt no.', payment.invoiceNo],
    ['Date', when],
    ['Billed to', `${member?.name || 'Member'}${member?.memberCode ? ` (${member.memberCode})` : ''}`],
    member?.phone ? ['Phone', member.phone] : null,
    payment.mode && !isDue ? ['Paid by', `${paymentModeLabel(payment.mode)}${payment.txnRef ? `, ref ${payment.txnRef}` : ''}`] : null,
    isPart && due?.invoiceNo ? ['Part payment of bill', due.invoiceNo] : null,
  ].filter(Boolean);

  const refund = payment.status === 'refunded' && payment.refund
    ? `<p class="note">Refunded ${escapeHtml(inr(payment.refund.amount ?? payment.amount))} on ${escapeHtml(toGymTime(payment.refund.at).format('DD MMM YYYY'))}${payment.refund.reason ? `: ${escapeHtml(payment.refund.reason)}` : ''}.</p>`
    : '';
  const balance = isPart && payment.balanceAfter != null
    ? `<tr class="sub"><td>Balance due after this payment</td><td class="n">${escapeHtml(inr(payment.balanceAfter))}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} ${escapeHtml(payment.invoiceNo)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#15171a;margin:0;padding:24px 16px;background:#eceef1;line-height:1.45}
  .r{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px}
  .head{display:flex;gap:14px;align-items:center;border-bottom:2px solid #15171a;padding-bottom:16px}
  .head img{width:56px;height:56px;object-fit:contain;border-radius:10px}
  .head h1{font-size:20px;margin:0}
  .muted{color:#5b616a;font-size:13px;margin:2px 0 0}
  .title{display:flex;justify-content:space-between;align-items:center;margin:20px 0 8px;gap:12px}
  .title h2{font-size:17px;margin:0}
  .pill{display:inline-block;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;color:${status.color};background:${status.bg}}
  .meta{display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;font-size:14px;margin:12px 0 4px}
  .meta span:nth-child(odd){color:#5b616a}
  table{width:100%;border-collapse:collapse;margin:18px 0 6px}
  th,td{text-align:left;padding:10px 0;border-bottom:1px solid #e2e5e9;font-size:14px;vertical-align:top}
  th{font-size:12px;color:#5b616a;font-weight:600}
  td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  tr.sub td{color:#474c54}
  tr.total td{font-weight:700;font-size:17px;border-bottom:0;padding-top:14px}
  .words{font-size:13px;color:#474c54;margin:0 0 12px}
  .note{font-size:13px;background:#f4f5f7;border-radius:10px;padding:10px 12px;margin:12px 0 0}
  .foot{margin-top:24px;font-size:12px;color:#5b616a;border-top:1px solid #e2e5e9;padding-top:12px}
  @media print{body{background:#fff;padding:0}.r{border-radius:0;padding:0;max-width:none}}
</style></head>
<body><main class="r">
  <header class="head">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="" width="56" height="56">` : ''}
    <div>
      <h1>${escapeHtml(gymName)}</h1>
      ${settings?.address ? `<p class="muted">${escapeHtml(settings.address)}</p>` : ''}
      ${contact ? `<p class="muted">${escapeHtml(contact)}</p>` : ''}
    </div>
  </header>
  <div class="title"><h2>${escapeHtml(title)}</h2><span class="pill">${escapeHtml(status.label)}</span></div>
  <div class="meta">${meta.map(([k, v]) => `<span>${escapeHtml(k)}</span><span>${escapeHtml(v)}</span>`).join('')}</div>
  <table>
    <thead><tr><th>Item</th><th class="n">Amount</th></tr></thead>
    <tbody>
      ${rows.map(([k, v]) => `<tr class="sub"><td>${escapeHtml(k)}</td><td class="n">${escapeHtml(v)}</td></tr>`).join('')}
      <tr><td>${escapeHtml(item)}${payment.note ? `<br><span class="muted">${escapeHtml(payment.note)}</span>` : ''}</td><td class="n">${escapeHtml(inr(payment.amount))}</td></tr>
      ${balance}
      <tr class="total"><td>${isDue ? 'Amount due' : 'Amount paid'}</td><td class="n">${escapeHtml(inr(payment.amount))}</td></tr>
    </tbody>
  </table>
  <p class="words">${escapeHtml(amountInWords(payment.amount))}</p>
  ${refund}
  <p class="foot">${isDue ? 'Pay at the front desk or in the member app.' : 'Thank you. This is a computer-generated receipt and needs no signature.'}</p>
</main></body></html>`;
}

/**
 * Everything a receipt needs, in one place for staff, member and email copies.
 * `memberId` restricts it to the member's own payments (member routes).
 */
export async function loadReceipt(paymentId, { memberId } = {}) {
  const payment = await Payment.findById(paymentId).lean();
  if (!payment || (memberId && String(payment.memberId) !== String(memberId))) {
    throw new AppError('Payment not found', 404, 'NOT_FOUND');
  }
  const [member, membership, settings, due] = await Promise.all([
    Member.findById(payment.memberId).select('name memberCode phone email').lean(),
    payment.membershipId ? Membership.findById(payment.membershipId).select('planName').lean() : null,
    getSettingsDoc(),
    payment.dueId ? Payment.findById(payment.dueId).select('invoiceNo originalAmount amount').lean() : null,
  ]);
  const html = renderReceiptHtml({ payment, member, settings, planName: membership?.planName, due });
  return { payment, member, settings, planName: membership?.planName, html };
}

/**
 * A payment settled the last due on a waiting membership, so it started: tell the member once
 * (in-app + the existing welcome email). Safe to call from every payment path.
 */
export async function notifyMembershipActivated(membership, { createdBy } = {}) {
  if (!membership) return null;
  const settings = await getSettingsDoc();
  const until = toGymTime(membership.endDate).format('DD MMM YYYY');
  return notifyMember({
    memberId: membership.memberId,
    kind: 'membership_active',
    title: `Your ${membership.planName || 'membership'} is active`,
    body: `Paid in full. Your plan runs until ${until}.`,
    link: '/member/membership',
    email: {
      templateKey: 'welcome',
      vars: { planName: membership.planName, startDate: membership.startDate, endDate: membership.endDate, gymName: settings.gymName },
    },
    dedupeKey: `membership-active:${membership._id}`,
    createdBy,
  });
}

/**
 * Tell the member about a payment and email them the receipt (through notifyMember, so it shows
 * in the member app and respects their email choice).
 *   auto: true   sent once per payment (dedupeKey), e.g. after an online or UPI payment is confirmed
 *   auto: false  a copy someone asked for; always recorded as a new message, and we wait for the
 *                send so the person who asked hears whether it really went
 * @returns {{ emailed: boolean, status: 'sent'|'queued'|'failed'|'skipped', reason?: string, to?: string }}
 */
export async function sendReceipt(paymentId, { auto = false, createdBy, memberId } = {}) {
  const { payment, member, settings, planName, html } = await loadReceipt(paymentId, { memberId });
  if (!['paid', 'refunded'].includes(payment.status)) throw new AppError('Receipts are only available for paid payments', 409, 'NOT_PAID');
  const item = planName ? `${paymentTypeLabel(payment.type)}: ${planName}` : paymentTypeLabel(payment.type);
  const { notification, created, emailLogId } = await notifyMember({
    memberId: payment.memberId,
    kind: 'receipt',
    title: `Payment received: ${inr(payment.amount)}`,
    body: `${item}. Receipt ${payment.invoiceNo}.`,
    link: `/member/payments/${payment._id}`,
    email: { templateKey: 'paymentReceipt', vars: { invoiceNo: payment.invoiceNo, receiptHtml: html, gymName: settings.gymName } },
    dedupeKey: auto ? `receipt:${payment._id}` : undefined,
    meta: { paymentId: String(payment._id), invoiceNo: payment.invoiceNo },
    createdBy,
  });
  const email = notification?.channels?.email;
  let status = email?.status || 'skipped';
  let reason = email?.reason || '';
  if (!auto && emailLogId) {
    const outcome = await waitForEmail(emailLogId);
    status = outcome.status;
    reason = outcome.error || reason;
  }
  return { created, emailed: status === 'sent' || status === 'queued', status, reason, to: member?.email || '' };
}
