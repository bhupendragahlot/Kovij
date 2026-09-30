import cron from 'node-cron';
import { runReminders, runScheduledReminders } from '../services/reminderService.js';
import { logger } from '../utils/logger.js';
import { GYM_TZ } from '../utils/time.js';

/**
 * Automatic reminders (membership expiry, "come back", payment due, birthdays).
 *
 * Checked every hour in gym time. Today's reminders go out on the first check at or after
 * settings.reminders.sendHour (so a changed send hour applies without a restart, and a server
 * that was asleep or restarting at that hour catches up later the same day, until 9 pm).
 * Each send has a dedupeKey, so overlapping runs and "Send now" never message anyone twice.
 */

/** One daily run as of `now` (used by tests and "Send now"). */
export const runRemindersJob = (now = new Date(), opts = {}) => runReminders(now, opts);

let running = false;

/** The hourly check. Returns what it decided, for logs and tests. */
export async function runReminderTick(now = new Date()) {
  if (running) return { ran: false, reason: 'already_running' };
  running = true;
  try {
    const result = await runScheduledReminders(now);
    if (!result.ran && result.reason !== 'before_send_hour' && result.reason !== 'done_today') {
      logger.info(`Reminders not sent this hour: ${result.reason}`);
    }
    return result;
  } finally {
    running = false;
  }
}

const tick = () => runReminderTick().catch((e) => logger.error(`reminder cron: ${e.message}`));

export function startReminderCron() {
  cron.schedule('5 * * * *', tick, { timezone: GYM_TZ });
  // Catch up shortly after a restart instead of waiting for the next hour.
  setTimeout(tick, 60_000).unref();
}
