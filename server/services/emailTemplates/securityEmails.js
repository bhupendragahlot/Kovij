/**
 * OWNER: security module. Staff account emails. Every interpolated value is escaped.
 */
import { escapeHtml } from '../../utils/strings.js';
import { toGymTime } from '../../utils/time.js';
import { registerTemplates, wrapEmail } from './index.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';
const safeLink = (url) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(url || '')) ? String(url) : '');

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#ff7a1a;color:#1f1003;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${escapeHtml(label)}</a></p>`;

function staffPasswordReset({ name, link, minutes = 60, gymName = DEFAULT_GYM, byAdmin = false }) {
  const subject = `Reset your ${gymName} desk password`;
  const href = safeLink(link);
  const html = wrapEmail(
    subject,
    `<p>Hi ${escapeHtml(name || 'there')},</p>
    <p>${byAdmin ? 'The gym owner sent you a link to set a new password for the staff desk app.' : 'Someone asked to reset the password for your staff desk account.'}
    Use the button below to choose a new password. The link works once and stops working after ${escapeHtml(minutes)} minutes.</p>
    ${href ? button(href, 'Set a new password') : ''}
    <p style="color:#626771;font-size:13px">If the button doesn’t work, copy this link into your browser:<br>${escapeHtml(href)}</p>
    <p style="color:#626771;font-size:13px">Didn’t ask for this? You can ignore this email; your password stays the same.</p>`
  );
  return { subject, html };
}

function staffPasswordChanged({ name, gymName = DEFAULT_GYM, at }) {
  const subject = `Your ${gymName} desk password was changed`;
  const when = at ? toGymTime(at).format('D MMM YYYY, h:mm a') : '';
  const html = wrapEmail(
    subject,
    `<p>Hi ${escapeHtml(name || 'there')},</p>
    <p>The password for your staff desk account was changed${when ? ` on ${escapeHtml(when)}` : ''}. Other devices were signed out.</p>
    <p>If this wasn’t you, tell the gym owner straight away so they can reset it.</p>`
  );
  return { subject, html };
}

registerTemplates({ staffPasswordReset, staffPasswordChanged });
