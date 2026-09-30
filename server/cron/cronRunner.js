import { logger } from '../utils/logger.js';
import { startExpiryCron } from './expiryCron.js';
import { startReminderCron } from './reminderCron.js';
import { startAnnouncementCron } from './announcementCron.js';
// Registers the web push channel with notifyMember for scheduled sends.
import '../services/pushChannel.js';

/**
 * OWNER: engagement module. Every scheduled job, all in gym time:
 *   hourly :00   housekeeping (expire ended plans, start queued renewals)      expiryCron.js
 *   hourly :05   reminders, once a day at/after settings.reminders.sendHour   reminderCron.js
 *   every 5 min  scheduled announcements and interrupted deliveries            announcementCron.js
 */
export function startAllCrons() {
  if (process.env.ENABLE_CRON === 'false') {
    logger.info('Cron jobs disabled (ENABLE_CRON=false)');
    return;
  }
  startExpiryCron();
  startReminderCron();
  startAnnouncementCron();
  logger.info('Cron jobs scheduled');
}
