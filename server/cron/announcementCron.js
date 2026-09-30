import cron from 'node-cron';
import { runAnnouncementsJob as runJob } from '../services/announcementService.js';
import { logger } from '../utils/logger.js';
import { GYM_TZ } from '../utils/time.js';

/**
 * Every 5 minutes: publish scheduled announcements that are due, and resume deliveries that a
 * restart interrupted (each member is still notified at most once).
 */
export const runAnnouncementsJob = (now = new Date()) => runJob(now);

let running = false;

export function startAnnouncementCron() {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      if (running) return;
      running = true;
      try {
        const { published, delivered } = await runAnnouncementsJob();
        if (published || delivered) logger.info(`Announcements: ${published} published, ${delivered} deliveries run`);
      } catch (e) {
        logger.error(`announcement cron: ${e.message}`);
      } finally {
        running = false;
      }
    },
    { timezone: GYM_TZ }
  );
}
