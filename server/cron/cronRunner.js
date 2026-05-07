import { logger } from '../utils/logger.js';
import { startExpiryCron } from './expiryCron.js';
import { startReminderCron } from './reminderCron.js';

export function startAllCrons() {
  if (process.env.ENABLE_CRON === 'false') {
    logger.info('Cron jobs disabled (ENABLE_CRON=false)');
    return;
  }
  startReminderCron();
  startExpiryCron();
  logger.info('Cron jobs scheduled');
}
