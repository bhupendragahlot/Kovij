/**
 * OWNER: engagement module. Emails for automatic reminders, announcements and staff messages.
 * Registered at load; imported by services/memberNotifier.js. Every interpolated value is
 * escaped, including staff-written announcement and message text (sent as plain text).
 *
 * Inline styles and table layout because email clients (Gmail app, Outlook) ignore most CSS.
 * Colours mirror the app's light theme tokens (emails have no CSS variables).
 */
import { escapeHtml } from '../../utils/strings.js';
import { toGymTime } from '../../utils/time.js';
import { BRAND_IMAGES, absoluteAppUrl } from '../../utils/publicUrl.js';
import { registerTemplates, wrapEmail } from './index.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';
const DEFAULT_APP_URL = 'https://kovij.onrender.com';

const C = {
  canvas: '#eceef1',
  surface: '#ffffff',
  surface2: '#f4f5f7',
  line: '#e2e5e9',
  ink: '#15171a',
  ink2: '#474c54',
  ink3: '#626771',
  muted: '#8e949d',
  rail: '#131417',
  brand: '#ff7a1a',
  onBrand: '#1f1003',
  brandInk: '#b34700',
};

/** Absolute link into the member app (APP_URL, e.g. https://kovijfitness.in). */
export function appLink(path = '/member/dashboard') {
  const base = (process.env.APP_URL || DEFAULT_APP_URL).trim().replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const money = (n) => inr.format(Number(n) || 0);
const day = (value) => (value ? toGymTime(value).format('D MMM YYYY') : '');
export const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
/** Subjects are headers: one line, bounded. */
export const oneLine = (s, max = 150) => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const safeImage = (url) => (/^https:\/\/[^\s"'<>]+$/i.test(String(url || '')) ? String(url) : '');

/** Escaped plain text → paragraphs, keeping the writer's line breaks. */
export function textToHtml(text) {
  return String(text || '')
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((para) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink2}">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export const para = (text) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink2}">${escapeHtml(text)}</p>`;

function detailsTable(rows) {
  const clean = rows.filter((r) => r && r.value !== '' && r.value != null);
  if (!clean.length) return '';
  const body = clean
    .map(
      (r, i) => `<tr>
        <td style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-size:14px;color:${C.ink3}">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ''}font-size:14px;color:${C.ink};font-weight:${r.strong ? 700 : 600};text-align:right">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;background:${C.surface2};border-radius:12px"><tr><td style="padding:6px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
  </td></tr></table>`;
}

function button(label, url) {
  if (!url) return '';
  const href = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 10px"><tr>
    <td style="border-radius:10px;background:${C.brand}">
      <a href="${href}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:700;color:${C.onBrand};text-decoration:none;border-radius:10px">${escapeHtml(label)}</a>
    </td></tr></table>
    <p style="margin:0 0 18px;font-size:12px;color:${C.muted}">Or open ${href}</p>`;
}

function contactBlock(gymName, contact = {}) {
  const parts = [];
  if (contact.phone) parts.push(`Call <a href="tel:${escapeHtml(String(contact.phone).replace(/[^\d+]/g, ''))}" style="color:${C.brandInk};text-decoration:none;font-weight:600">${escapeHtml(contact.phone)}</a>`);
  if (contact.whatsapp) parts.push(`WhatsApp <a href="https://wa.me/${escapeHtml(String(contact.whatsapp).replace(/\D/g, ''))}" style="color:${C.brandInk};text-decoration:none;font-weight:600">${escapeHtml(contact.whatsapp)}</a>`);
  if (contact.email) parts.push(`<a href="mailto:${escapeHtml(contact.email)}" style="color:${C.brandInk};text-decoration:none;font-weight:600">${escapeHtml(contact.email)}</a>`);
  const lines = [];
  if (parts.length) lines.push(`Questions? ${parts.join(' &middot; ')}`);
  if (contact.address) lines.push(escapeHtml(contact.address));
  if (!lines.length) return '';
  return `<p style="margin:0;font-size:13px;line-height:1.6;color:${C.ink3}">${escapeHtml(gymName)}<br>${lines.join('<br>')}</p>`;
}

/**
 * Shared card layout.
 * @param {{ gymName?: string, preheader?: string, eyebrow?: string, heading: string, bodyHtml: string,
 *           imageUrl?: string, cta?: { label: string, url: string }, contact?: object, footerNote?: string }} o
 */
export function layout(o) {
  const gymName = o.gymName || DEFAULT_GYM;
  const image = safeImage(o.imageUrl);
  const html = `
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.surface};border-radius:16px;overflow:hidden">
      <tr><td style="background:${C.rail};padding:18px 24px;border-top:4px solid ${C.brand}">
        <img src="${escapeHtml(absoluteAppUrl(BRAND_IMAGES.logoOnDark))}" alt="${escapeHtml(gymName)}" width="150" height="42" style="display:block;border:0;height:auto;max-width:150px;font-size:17px;font-weight:700;color:#ffffff">
      </td></tr>
      ${image ? `<tr><td><img src="${escapeHtml(image)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0"></td></tr>` : ''}
      <tr><td style="padding:28px 24px 8px">
        ${o.eyebrow ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${C.brandInk}">${escapeHtml(o.eyebrow)}</p>` : ''}
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.ink};letter-spacing:-0.01em">${escapeHtml(o.heading)}</h1>
        ${o.bodyHtml}
        ${o.cta ? button(o.cta.label, o.cta.url) : ''}
      </td></tr>
      <tr><td style="padding:8px 24px 24px">
        <div style="border-top:1px solid ${C.line};padding-top:16px">${contactBlock(gymName, o.contact)}</div>
      </td></tr>
    </table>
    <p style="max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.5;color:${C.muted}">${escapeHtml(
      o.footerNote || `You're receiving this because you're a member of ${gymName}. Choose which notifications you get in the app under Account, Settings.`
    )}</p>
  </td></tr>
</table>`;
  return wrapEmail(o.heading, html, { logo: false });
}

export function reminderExpirySoonEmail({ name, gymName = DEFAULT_GYM, planName, endDate, days, renewPrice, contact, ctaUrl }) {
  const n = Number(days) || 0;
  const when = n === 1 ? 'tomorrow' : `in ${n} days`;
  const subject = oneLine(`Your ${gymName} plan ends ${when}`);
  const html = layout({
    gymName,
    contact,
    preheader: `Renew before ${day(endDate)} to keep training without a break.`,
    eyebrow: 'Membership reminder',
    heading: `Your plan ends ${when}`,
    bodyHtml:
      para(`Hi ${first(name)}, your ${planName || 'membership'} plan ends on ${day(endDate)}.`) +
      para('Renew before then and your new plan starts the day this one ends, so you don’t lose a single day of training.') +
      detailsTable([
        { label: 'Plan', value: planName },
        { label: 'Ends on', value: day(endDate) },
        { label: 'Renewal price', value: Number(renewPrice) > 0 ? money(renewPrice) : '' },
      ]),
    cta: { label: 'Renew my plan', url: ctaUrl || appLink('/member/membership') },
  });
  return { subject, html };
}

export function reminderExpiryTodayEmail({ name, gymName = DEFAULT_GYM, planName, endDate, renewPrice, contact, ctaUrl }) {
  const subject = oneLine(`Your ${gymName} plan ends today`);
  const html = layout({
    gymName,
    contact,
    preheader: 'Renew today to keep checking in without a break.',
    eyebrow: 'Membership reminder',
    heading: 'Your plan ends today',
    bodyHtml:
      para(`Hi ${first(name)}, your ${planName || 'membership'} plan ends today, ${day(endDate)}.`) +
      para('Renew in the app or at the front desk to keep checking in without a break.') +
      detailsTable([
        { label: 'Plan', value: planName },
        { label: 'Renewal price', value: Number(renewPrice) > 0 ? money(renewPrice) : '' },
      ]),
    cta: { label: 'Renew my plan', url: ctaUrl || appLink('/member/membership') },
  });
  return { subject, html };
}

export function reminderComeBackEmail({ name, gymName = DEFAULT_GYM, planName, endDate, days, renewPrice, contact, ctaUrl }) {
  const subject = oneLine(`We miss you at ${gymName}`);
  const n = Number(days) || 0;
  const html = layout({
    gymName,
    contact,
    preheader: 'Renew in the app or at the front desk and start again the same day.',
    eyebrow: 'We miss you',
    heading: `Come back, ${first(name)}`,
    bodyHtml:
      para(`Your ${planName || 'membership'} plan ended on ${day(endDate)}${n ? `, ${n} ${n === 1 ? 'day' : 'days'} ago` : ''}.`) +
      para('Progress is easier to keep than to rebuild. Renew in the app or drop by the front desk and you can start again the same day.') +
      detailsTable([
        { label: 'Last plan', value: planName },
        { label: 'Renewal price', value: Number(renewPrice) > 0 ? money(renewPrice) : '' },
      ]),
    cta: { label: 'See plans and renew', url: ctaUrl || appLink('/member/membership') },
  });
  return { subject, html };
}

export function reminderPaymentDueEmail({ name, gymName = DEFAULT_GYM, amount, items = [], contact, ctaUrl }) {
  const subject = oneLine(`Payment reminder: ${money(amount)} due at ${gymName}`);
  const rows = (Array.isArray(items) ? items : []).slice(0, 5).map((i) => ({ label: i.label, value: money(i.amount) }));
  const html = layout({
    gymName,
    contact,
    preheader: `${money(amount)} is due. Pay at the front desk or in the app.`,
    eyebrow: 'Payment reminder',
    heading: `You have ${money(amount)} due`,
    bodyHtml:
      para(`Hi ${first(name)}, this is a friendly reminder that ${money(amount)} is due at ${gymName}.`) +
      detailsTable([...rows, { label: 'Total due', value: money(amount), strong: true }]) +
      para('Pay at the front desk or in the app. Already paid? Show your receipt at the desk and we’ll update it.'),
    cta: { label: 'Pay now', url: ctaUrl || appLink('/member/payments') },
  });
  return { subject, html };
}

export function birthdayWishEmail({ name, gymName = DEFAULT_GYM, contact }) {
  const subject = oneLine(`Happy birthday from ${gymName}!`);
  const html = layout({
    gymName,
    contact,
    preheader: `Everyone at ${gymName} wishes you a great year ahead.`,
    eyebrow: 'Happy birthday',
    heading: `Happy birthday, ${first(name)}!`,
    bodyHtml:
      para(`Everyone at ${gymName} wishes you a healthy, strong year ahead.`) + para('Come celebrate with a great workout today. We’ll see you on the floor!'),
  });
  return { subject, html };
}

const CATEGORY_LABEL = { event: 'Event', offer: 'Offer', holiday: 'Holiday notice', notice: 'Notice' };

export function announcementEmail({ gymName = DEFAULT_GYM, title, body, category, imageUrl, contact, ctaUrl }) {
  const subject = oneLine(`${title || 'News'} | ${gymName}`);
  const html = layout({
    gymName,
    contact,
    imageUrl,
    preheader: oneLine(body, 120),
    eyebrow: CATEGORY_LABEL[category] || 'Notice',
    heading: title || 'News from the gym',
    bodyHtml: textToHtml(body),
    cta: { label: 'Open in the app', url: ctaUrl || appLink('/member/dashboard') },
    footerNote: `You're receiving this because you're a member of ${gymName}. Turn off announcement emails in the app under Account, Settings.`,
  });
  return { subject, html };
}

export function memberMessageEmail({ name, gymName = DEFAULT_GYM, subject: title, body, contact }) {
  const subject = oneLine(title || `A message from ${gymName}`);
  const html = layout({
    gymName,
    contact,
    preheader: oneLine(body, 120),
    heading: title || `A message from ${gymName}`,
    bodyHtml: para(`Hi ${first(name)},`) + textToHtml(body),
    footerNote: `Sent to you by the team at ${gymName}. Reply to this email or call us to respond.`,
  });
  return { subject, html };
}

registerTemplates({
  reminderExpirySoon: reminderExpirySoonEmail,
  reminderExpiryToday: reminderExpiryTodayEmail,
  reminderComeBack: reminderComeBackEmail,
  reminderPaymentDue: reminderPaymentDueEmail,
  birthdayWish: birthdayWishEmail,
  announcement: announcementEmail,
  memberMessage: memberMessageEmail,
});
