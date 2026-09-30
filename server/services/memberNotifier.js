/**
 * Engagement module's entry to notifyMember(): same arguments and result, plus the email this
 * notification queued is linked to it, so the notification's email status later becomes the
 * real outcome (sent, or failed with the reason). Also registers the module's email templates
 * and the push channel, so any code path that sends through here has both available.
 */
import { notifyMember } from './notify.js';
import { emailTracking, linkEmailToNotification } from './emailService.js';
import { logger } from '../utils/logger.js';
import './emailTemplates/engagementEmails.js';
import './pushChannel.js';

export { appLink } from './emailTemplates/engagementEmails.js';

/** @param {Parameters<typeof notifyMember>[0]} args */
export async function sendToMember(args) {
  const queued = [];
  const result = await emailTracking.run({ onQueued: (log) => queued.push(log._id) }, () => notifyMember(args));
  if (result.created && result.notification && queued.length) {
    await linkEmailToNotification(queued[0], result.notification._id).catch((e) =>
      logger.warn(`Could not link email to notification ${result.notification._id}: ${e.message}`)
    );
  }
  return result;
}

/** Gym contact details shown at the bottom of every member email. */
export function gymContact(settings = {}) {
  return {
    phone: settings.phone || '',
    whatsapp: settings.whatsapp || '',
    email: settings.email || '',
    address: settings.address || '',
  };
}
