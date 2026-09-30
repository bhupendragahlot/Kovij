import cron from 'node-cron';
import { rollOverMemberships } from '../services/membershipService.js';
import { logger } from '../utils/logger.js';
import { GYM_TZ } from '../utils/time.js';

/**
 * Membership housekeeping, every hour: plans whose end has passed become `expired`, and queued
 * renewals (`upcoming`) whose start has come become `active`. Idempotent and cheap (two
 * updateMany calls). Member messages about expiry are sent by the reminders job (reminderCron.js).
 */
export async function runHousekeepingJob(now = new Date()) {
  const result = await rollOverMemberships(now);
  if (result.expired || result.started) logger.info(`Housekeeping: ${result.expired} plans expired, ${result.started} renewals started`);
  return result;
}

/** @deprecated Old name; expiry emails now come from the reminders job. */
export const runExpiryJob = runHousekeepingJob;

let running = false;

export function startExpiryCron() {
  cron.schedule(
    '0 * * * *',
    async () => {
      if (running) return;
      running = true;
      try {
        await runHousekeepingJob();
      } catch (e) {
        logger.error(`housekeeping cron: ${e.message}`);
      } finally {
        running = false;
      }
    },
    { timezone: GYM_TZ }
  );
}
