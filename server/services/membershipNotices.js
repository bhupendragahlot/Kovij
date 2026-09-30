/**
 * Telling a member that their plan changed (freeze, unfreeze, extension). Goes through
 * notifyMember, so it lands in the in-app inbox, respects preferences, and is deduplicated per event.
 */
import { registerTemplates, wrapEmail } from './emailTemplates/index.js';
import { notifyMember } from './notify.js';
import { getSettingsDoc } from '../models/Settings.js';
import { escapeHtml } from '../utils/strings.js';
import { toGymTime } from '../utils/time.js';

const day = (value) => (value ? toGymTime(value).format('D MMM YYYY') : '');
/** A freeze ends at the start of the day the plan resumes, so the last day on hold is the day before. */
const lastDayBefore = (value) => day(new Date(new Date(value).getTime() - 1));

export function membershipUpdateEmail({ name, heading, message, gymName = 'Kovij Fitness Zone' }) {
  const subject = `${heading} | ${gymName}`;
  const html = wrapEmail(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p><strong>${escapeHtml(heading)}</strong></p>
    <p>${escapeHtml(message)}</p>
    <p>Questions? Reply to this email or ask at the front desk.</p>
    <p>${escapeHtml(gymName)}</p>`
  );
  return { subject, html };
}

registerTemplates({ membershipChangeNotice: membershipUpdateEmail });

/** Title and message for each change. Pure (unit tested). */
export function membershipNotice(kind, { membership, event, endedHow }) {
  const plan = membership.planName || 'Your plan';
  const ends = day(membership.endDate);
  switch (kind) {
    case 'frozen': {
      const startsLater = membership.status !== 'paused';
      return {
        title: startsLater ? `Your plan will be on hold from ${day(event.effectiveFrom)}` : 'Your plan is on hold',
        body: `${plan} is on hold from ${day(event.effectiveFrom)} to ${lastDayBefore(event.effectiveTo)}. You can train again from ${day(event.effectiveTo)}, and your plan now ends on ${ends}.`,
      };
    }
    case 'unfrozen':
      return endedHow === 'cancelled'
        ? { title: 'Your planned freeze was removed', body: `${plan} carries on as normal and ends on ${ends}.` }
        : { title: 'Your plan is active again', body: `Welcome back. ${plan} now ends on ${ends}.` };
    case 'resumed':
      return { title: 'Welcome back, your plan is active again', body: `Your freeze has ended. ${plan} now ends on ${ends}.` };
    case 'extended':
      return {
        title: `${event.days} ${event.days === 1 ? 'day' : 'days'} added to your plan`,
        body: `${plan} now ends on ${ends}.`,
      };
    default:
      throw new Error(`Unknown membership notice "${kind}"`);
  }
}

/**
 * @param {'frozen'|'unfrozen'|'resumed'|'extended'} kind
 * @param {{ membership, event, endedHow? }} result  what freeze/unfreeze/extend returned
 */
export async function notifyMembershipChange(kind, result, { staffId } = {}) {
  const { membership, event } = result;
  const { title, body } = membershipNotice(kind, result);
  const settings = await getSettingsDoc();
  return notifyMember({
    memberId: membership.memberId,
    kind: 'membership',
    title,
    body,
    link: '/member/membership',
    email: { templateKey: 'membershipChangeNotice', vars: { heading: title, message: body, gymName: settings.gymName } },
    dedupeKey: `membership:${membership._id}:${kind}:${event._id}`,
    meta: { membershipId: String(membership._id), change: kind },
    createdBy: staffId,
  });
}
