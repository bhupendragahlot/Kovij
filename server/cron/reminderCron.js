import cron from 'node-cron';
import Membership from '../models/Membership.js';
import Member from '../models/Member.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';
import { GYM_TZ, toGymTime } from '../utils/time.js';

/** 09:00 gym time: remind members whose plan ends in 3 days and who haven't renewed yet. */
export async function runReminderJob(now = new Date()) {
  const target = toGymTime(now).add(3, 'day');
  const list = await Membership.find({
    status: 'active',
    endDate: { $gte: target.startOf('day').toDate(), $lte: target.endOf('day').toDate() },
  }).lean();

  const renewing = new Set(
    (await Membership.distinct('memberId', { status: { $in: ['upcoming', 'pending'] }, memberId: { $in: list.map((m) => m.memberId) } })).map(String)
  );
  const settings = await getSettingsDoc();
  let sent = 0;
  for (const m of list) {
    if (renewing.has(String(m.memberId))) continue;
    if (m.lastReminderSentAt && toGymTime(m.lastReminderSentAt).isSame(toGymTime(now), 'day')) continue;
    const member = await Member.findById(m.memberId).select('email name').lean();
    if (!member?.email) continue;
    await queueEmail({ to: member.email, templateKey: 'expiryReminder', vars: { name: member.name, endDate: m.endDate, gymName: settings.gymName } });
    await Membership.findByIdAndUpdate(m._id, { lastReminderSentAt: new Date() });
    sent += 1;
  }
  logger.info(`Reminder job: ${sent} reminders queued`);
}

export function startReminderCron() {
  cron.schedule(
    '0 9 * * *',
    () => runReminderJob().catch((e) => logger.error(`reminderCron: ${e.message}`)),
    { timezone: GYM_TZ }
  );
}
