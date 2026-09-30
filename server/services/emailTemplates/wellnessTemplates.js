/**
 * Email templates for the wellness module (diet plans). Registered at load; imported by
 * services/dietService.js. Every interpolated value is escaped. Emails carry no numbers about
 * the member's body or intake: those stay in the app.
 */
import { registerTemplates, wrapEmail } from './index.js';
import { escapeHtml } from '../../utils/strings.js';
import { toGymTime } from '../../utils/time.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';
const formatDate = (value) => (value ? toGymTime(value).format('ddd, D MMM YYYY') : '');

export function dietPlanAssignedEmail({ name, planName, startDate, trainerName, gymName = DEFAULT_GYM }) {
  const subject = `Your diet plan from ${gymName}`;
  const html = wrapEmail(
    subject,
    `<p>Hi ${escapeHtml(name || 'there')},</p>
    <p>${trainerName ? `${escapeHtml(trainerName)} has` : 'Your trainer has'} set up a diet plan for you: <strong>${escapeHtml(planName)}</strong>.</p>
    <p>It starts on <strong>${escapeHtml(formatDate(startDate))}</strong>. Open the ${escapeHtml(gymName)} app to see your meals and tick them off as you go.</p>
    <p>Questions about the plan? Ask your trainer at the gym.</p>`
  );
  return { subject, html };
}

registerTemplates({ dietPlanAssigned: dietPlanAssignedEmail });
