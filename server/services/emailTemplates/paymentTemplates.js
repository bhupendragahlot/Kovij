/**
 * Email templates owned by the payments module. Registered at load; imported by receiptService
 * and paymentVerificationService so they exist before anything is sent.
 */
import { registerTemplates, wrapEmail } from './index.js';
import { escapeHtml } from '../../utils/strings.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

/** `receiptHtml` comes from receiptService.renderReceiptHtml, which escapes its own values. */
function paymentReceipt({ name, invoiceNo, receiptHtml, gymName = DEFAULT_GYM }) {
  const subject = `Receipt ${invoiceNo} from ${gymName}`;
  const html = receiptHtml || wrapEmail(subject, `<p>Hi ${escapeHtml(name)}, thank you for your payment. Your receipt number is ${escapeHtml(invoiceNo)}.</p>`);
  return { subject, html };
}

function upiReferenceRejected({ name, amount, utr, reason, invoiceNo, gymName = DEFAULT_GYM }) {
  const subject = `We couldn't confirm your UPI payment to ${gymName}`;
  const html = wrapEmail(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>We checked the UPI reference <strong>${escapeHtml(utr)}</strong> you sent for bill ${escapeHtml(invoiceNo)} (${escapeHtml(inr(amount))}) and couldn't match it to a payment we received.</p>
    ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
    <p>If money left your account, open your UPI app, copy the 12-digit UTR from the payment details and send it again in the member app, or show the payment at the front desk.</p>
    <p>${escapeHtml(gymName)}</p>`
  );
  return { subject, html };
}

registerTemplates({ paymentReceipt, upiReferenceRejected });
