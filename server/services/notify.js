/**
 * The one way to tell a member something (reminders, announcements, workout updates, receipts).
 *
 *   await notifyMember({
 *     memberId, kind: 'expiry_reminder', title: 'Your plan ends in 3 days', body: '…',
 *     link: '/member/membership',
 *     email: { templateKey: 'expiryReminder', vars: { … } },   // or false for in-app only
 *     preference: null,             // or 'announcements' | 'birthday' | 'workoutUpdates' (member can opt out)
 *     dedupeKey: `expiry:${membership._id}:3d`,                 // makes automated sends idempotent
 *   })
 *
 * Always records an in-app notification. Email goes through the logged email queue. Other
 * channels (web push) plug in with registerChannel() and never need callers to change.
 * Returns { notification, created }; `created` is false when the dedupeKey was already used.
 */
import Notification from '../models/Notification.js';
import Member from '../models/Member.js';
import { queueEmail } from './emailService.js';
import { logger } from '../utils/logger.js';

const channels = new Map();

/**
 * Add a delivery channel (e.g. 'push'). The handler receives ({ notification, member }) and
 * returns { status: 'sent'|'queued'|'skipped'|'failed', reason? }. It must not throw for
 * per-member problems (missing subscription, opt-out); report them as status instead.
 */
export function registerChannel(name, handler) {
  channels.set(name, handler);
}

const MEMBER_FIELDS = 'name email notificationPrefs isActive';

export async function notifyMember({ memberId, kind, title, body = '', link = '', email = false, preference = null, dedupeKey, meta, createdBy }) {
  const member = await Member.findById(memberId).select(MEMBER_FIELDS).lean();
  if (!member) return { notification: null, created: false };

  let notification;
  try {
    notification = await Notification.create({ memberId, kind, title, body, link, dedupeKey, meta, createdBy });
  } catch (e) {
    if (e?.code === 11000 && dedupeKey) {
      return { notification: await Notification.findOne({ dedupeKey }).lean(), created: false };
    }
    throw e;
  }

  const prefs = member.notificationPrefs || {};
  const optedOut = preference && prefs[preference] === false;
  const update = {};
  let emailLogId = null;

  // Email
  if (!email) update['channels.email'] = { status: 'skipped', reason: 'not_requested' };
  else if (!member.email) update['channels.email'] = { status: 'skipped', reason: 'no_email' };
  else if (optedOut || prefs.email === false) update['channels.email'] = { status: 'skipped', reason: 'opted_out' };
  else {
    try {
      // Linked to the notification, so its email status becomes the real outcome (sent, or failed and why).
      const log = await queueEmail({ to: member.email, templateKey: email.templateKey, vars: { name: member.name, ...email.vars }, notificationId: notification._id });
      emailLogId = log?._id || null;
      update['channels.email'] = { status: 'queued', at: new Date() };
    } catch (e) {
      logger.warn(`notify email failed for ${memberId}: ${e.message}`);
      update['channels.email'] = { status: 'failed', reason: e.message.slice(0, 200), at: new Date() };
    }
  }

  // Registered channels (push, …)
  for (const [name, handler] of channels) {
    if (optedOut || prefs[name] === false) {
      update[`channels.${name}`] = { status: 'skipped', reason: 'opted_out' };
      continue;
    }
    try {
      const result = await handler({ notification: notification.toObject(), member });
      update[`channels.${name}`] = { status: result?.status || 'skipped', reason: result?.reason || '', at: new Date() };
    } catch (e) {
      logger.warn(`notify ${name} failed for ${memberId}: ${e.message}`);
      update[`channels.${name}`] = { status: 'failed', reason: e.message.slice(0, 200), at: new Date() };
    }
  }

  // Only set the email status if the send hasn't already finished and recorded its outcome.
  const emailUpdate = update['channels.email'];
  delete update['channels.email'];
  await Notification.updateOne({ _id: notification._id, 'channels.email.status': { $nin: ['sent', 'failed'] } }, { $set: { 'channels.email': emailUpdate } });
  const saved = Object.keys(update).length
    ? await Notification.findByIdAndUpdate(notification._id, { $set: update }, { new: true }).lean()
    : await Notification.findById(notification._id).lean();
  return { notification: saved, created: true, emailLogId };
}
