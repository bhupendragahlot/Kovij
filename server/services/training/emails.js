/**
 * Email templates for workout messages. Imported by workoutService so they register at load.
 * Every interpolated value is escaped.
 */
import { registerTemplates, wrapEmail } from '../emailTemplates/index.js';
import { escapeHtml } from '../../utils/strings.js';
import { parseGymDay } from '../../utils/time.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';

function dayList(days = []) {
  return days
    .map(
      (d) =>
        `<li><strong>${escapeHtml(d.name)}</strong>${
          d.exercises?.length ? `: ${escapeHtml(d.exercises.map((e) => e.name).join(', '))}` : ''
        }</li>`
    )
    .join('');
}

export function workoutAssignedEmail({ name, planName, startDay, daysPerWeek, days, trainerName, gymName = DEFAULT_GYM }) {
  const subject = `Your workout plan at ${gymName}: ${planName}`;
  const start = startDay ? parseGymDay(startDay).format('dddd, D MMMM') : '';
  const html = wrapEmail(
    subject,
    `<p>Hi ${escapeHtml(name)},</p>
    <p>${trainerName ? `${escapeHtml(trainerName)} has` : "We've"} set up a workout plan for you: <strong>${escapeHtml(planName)}</strong>${
      start ? `, starting ${escapeHtml(start)}` : ''
    }. Aim for ${escapeHtml(daysPerWeek)} ${Number(daysPerWeek) === 1 ? 'session' : 'sessions'} a week and do the days in order.</p>
    <ul>${dayList(days)}</ul>
    <p>Ask a trainer on the floor if you're unsure how to do any exercise.</p>`
  );
  return { subject, html };
}

registerTemplates({ workoutAssigned: workoutAssignedEmail });
