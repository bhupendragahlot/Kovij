import { escapeHtml } from '../../utils/strings.js';
import { toGymTime } from '../../utils/time.js';
import { BRAND_IMAGES, absoluteAppUrl } from '../../utils/publicUrl.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';

/**
 * Email page. Plain emails get the Kovij logo on top (alt text stands in when images are blocked);
 * designs that draw their own header pass { logo: false }.
 */
function wrapHtml(title, body, { logo = true } = {}) {
  const header = logo
    ? `<p style="margin:0 0 20px"><img src="${escapeHtml(absoluteAppUrl(BRAND_IMAGES.logoOnLight))}" alt="Kovij Fitness Zone" width="168" height="47" style="display:block;border:0;height:auto;max-width:168px"></p>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#15171a">${header}${body}</body></html>`;
}

const formatDate = (value) => (value ? toGymTime(value).format('DD MMM YYYY') : '');

export function welcomeEmail({ name, planName, startDate, endDate, gymName = DEFAULT_GYM }) {
  const subject = `Welcome to ${gymName}`;
  const html = wrapHtml(
    subject,
    `<h2>Welcome, ${escapeHtml(name)}!</h2>
    <p>Your membership is active.</p>
    <ul>
      <li><strong>Plan:</strong> ${escapeHtml(planName)}</li>
      <li><strong>Starts:</strong> ${escapeHtml(formatDate(startDate))}</li>
      <li><strong>Ends:</strong> ${escapeHtml(formatDate(endDate))}</li>
    </ul>
    <p>See you at the gym.</p>`
  );
  return { subject, html };
}

export function joinReceivedEmail({ name, planName, amountDue, gymName = DEFAULT_GYM }) {
  const subject = `We received your ${gymName} registration`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>Your registration for <strong>${escapeHtml(planName)}</strong> is in. Pay <strong>${escapeHtml(amountDue)}</strong> at the front desk and your membership starts the same day.</p>`
  );
  return { subject, html };
}

export function expiryReminderEmail({ name, endDate, gymName = DEFAULT_GYM }) {
  const subject = `Your ${gymName} membership ends on ${formatDate(endDate)}`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>Your membership ends on <strong>${escapeHtml(formatDate(endDate))}</strong>. Renew at the front desk to keep training without a break.</p>`
  );
  return { subject, html };
}

export function expiredEmail({ name, gymName = DEFAULT_GYM }) {
  const subject = `Your ${gymName} membership has ended`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>Your membership has ended. Reply to this email or visit the front desk to renew.</p>`
  );
  return { subject, html };
}

export function planUpdatedEmail({ name, planName, startDate, endDate, changeType, gymName = DEFAULT_GYM }) {
  const subject = `Your ${gymName} plan was updated`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>Your plan was <strong>${escapeHtml(changeType)}</strong>.</p>
    <ul>
      <li><strong>Plan:</strong> ${escapeHtml(planName)}</li>
      <li><strong>Starts:</strong> ${escapeHtml(formatDate(startDate))}</li>
      <li><strong>Ends:</strong> ${escapeHtml(formatDate(endDate))}</li>
    </ul>`
  );
  return { subject, html };
}

/** `receiptHtml` is produced by receiptService, which escapes its own values. */
export function paymentBillEmail({ name, invoiceNo, receiptHtml, gymName = DEFAULT_GYM }) {
  const subject = `Receipt ${invoiceNo} from ${gymName}`;
  const html = receiptHtml || wrapHtml(subject, `<p>Hi ${escapeHtml(name)}, your receipt ${escapeHtml(invoiceNo)} is attached.</p>`);
  return { subject, html };
}

export function contactNotificationEmail({ name, email, phone, message }) {
  const subject = `Website enquiry from ${name}`;
  const html = wrapHtml(
    subject,
    `<h2>New website enquiry</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
    <p><strong>Message:</strong></p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    <p>It has been added to Leads in the Kovij desk app.</p>`
  );
  return { subject, html };
}

/** Auto-reply deliberately does not echo the visitor's message back (prevents relay abuse). */
export function contactAutoReplyEmail({ name, gymName = DEFAULT_GYM }) {
  const subject = `Thanks for contacting ${gymName}`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>We received your message and will get back to you within one working day.</p>
    <p>${escapeHtml(gymName)}</p>`
  );
  return { subject, html };
}

/**
 * Campaign bodies are written by staff (trusted HTML). Placeholders are filled with
 * escaped recipient data: {{name}}, {{firstName}}, {{gym}}.
 */
export function campaignBodyEmail({ subject, bodyHtml, name, gymName = DEFAULT_GYM }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
  const values = { name: name || 'there', firstName, gym: gymName };
  const fill = (text, encode) =>
    String(text || '').replace(/\{\{\s*(name|firstName|gym)\s*\}\}/g, (_, key) => encode(values[key]));
  // Subjects are plain text; bodies are HTML, so only the body needs escaping.
  return { subject: fill(subject, String), html: fill(bodyHtml, escapeHtml) };
}

/** Settings → Email → Send test email. */
export function emailTestEmail({ provider, server, gymName = DEFAULT_GYM }) {
  const subject = `Test email from ${gymName}`;
  const html = wrapHtml(
    subject,
    `<p>This is a test from the ${escapeHtml(gymName)} app. If you can read it, email is working.</p>
    <p style="color:#626771;font-size:13px">Sent through ${escapeHtml(server || '')} (${escapeHtml(provider || '')}).</p>`
  );
  return { subject, html };
}

const TEMPLATES = {
  welcome: welcomeEmail,
  joinReceived: joinReceivedEmail,
  expiryReminder: expiryReminderEmail,
  expired: expiredEmail,
  planUpdated: planUpdatedEmail,
  paymentBill: paymentBillEmail,
  contactNotification: contactNotificationEmail,
  contactAutoReply: contactAutoReplyEmail,
  emailTest: emailTestEmail,
  offer: campaignBodyEmail,
  festival: campaignBodyEmail,
  info: campaignBodyEmail,
  bulk: campaignBodyEmail,
};

/**
 * Modules add their own templates without editing this file:
 *   registerTemplates({ expiry7d: (vars) => ({ subject, html }) })
 * Call it at module load (top level of the module's template file). Keys must be unique.
 * Build templates with `wrapEmail` and escape every interpolated value with `escapeHtml`.
 */
export function registerTemplates(map) {
  for (const [key, fn] of Object.entries(map)) {
    if (TEMPLATES[key] && TEMPLATES[key] !== fn) throw new Error(`Email template "${key}" is already registered`);
    TEMPLATES[key] = fn;
  }
}

export const hasTemplate = (key) => Boolean(TEMPLATES[key]);

/** Shared page wrapper for module templates. */
export const wrapEmail = wrapHtml;

export function renderTemplate(key, vars) {
  const fn = TEMPLATES[key] || campaignBodyEmail;
  return fn(vars || {});
}
