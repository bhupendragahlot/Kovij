import { escapeHtml } from '../utils/strings.js';
import { toGymTime } from '../utils/time.js';

const TYPE_LABELS = {
  registration: 'Registration fee',
  membership: 'Membership',
  renewal: 'Membership renewal',
  personal_training: 'Personal training',
  other: 'Other',
};

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

export const paymentTypeLabel = (type) => TYPE_LABELS[type] || type;

/** Printable receipt. Every interpolated value is escaped. */
export function renderReceiptHtml({ member, payment, settings, planName }) {
  const gymName = settings?.gymName || 'Kovij Fitness Zone';
  const when = toGymTime(payment.paidAt || payment.createdAt || new Date()).format('DD MMM YYYY, HH:mm');
  const item = planName ? `${paymentTypeLabel(payment.type)}: ${planName}` : paymentTypeLabel(payment.type);
  const statusLabel = payment.status === 'paid' ? 'Paid' : payment.status === 'pending' ? 'Due' : 'Failed';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt ${escapeHtml(payment.invoiceNo)}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#15171a;margin:0;padding:32px;background:#fff}
  .r{max-width:560px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#5b616a;font-size:14px;margin:0}
  table{width:100%;border-collapse:collapse;margin:24px 0}
  th,td{text-align:left;padding:10px 0;border-bottom:1px solid #e2e5e9;font-size:14px}
  td.n{text-align:right;font-variant-numeric:tabular-nums}
  .total td{font-weight:700;font-size:16px;border-bottom:0}
  .meta{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:14px}
  @media print{body{padding:0}}
</style></head>
<body><div class="r">
  <h1>${escapeHtml(gymName)}</h1>
  <p class="muted">${escapeHtml(settings?.address || '')}${settings?.phone ? ` | ${escapeHtml(settings.phone)}` : ''}</p>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>${escapeHtml(item)}</td><td class="n">${escapeHtml(inr(payment.amount))}</td></tr>
      <tr class="total"><td>Total</td><td class="n">${escapeHtml(inr(payment.amount))}</td></tr>
    </tbody>
  </table>
  <div class="meta">
    <span class="muted">Receipt</span><span>${escapeHtml(payment.invoiceNo)}</span>
    <span class="muted">Billed to</span><span>${escapeHtml(member?.name)}${member?.memberCode ? ` (${escapeHtml(member.memberCode)})` : ''}</span>
    <span class="muted">Date</span><span>${escapeHtml(when)}</span>
    <span class="muted">Status</span><span>${escapeHtml(statusLabel)}</span>
    ${payment.mode ? `<span class="muted">Paid by</span><span>${escapeHtml(payment.mode.toUpperCase())}${payment.txnRef ? ` (${escapeHtml(payment.txnRef)})` : ''}</span>` : ''}
  </div>
</div></body></html>`;
}
