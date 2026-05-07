import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import Membership from '../models/Membership.js';
import Member from '../models/Member.js';
import { queueEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

dayjs.extend(utc);

export function startReminderCron() {
  cron.schedule('0 9 * * *', async () => {
    try {
      const start = dayjs().add(3, 'day').startOf('day').toDate();
      const end = dayjs().add(3, 'day').endOf('day').toDate();
      const list = await Membership.find({
        status: 'active',
        endDate: { $gte: start, $lte: end },
      }).lean();

      for (const m of list) {
        const already = m.lastReminderSentAt && dayjs(m.lastReminderSentAt).isSame(dayjs(), 'day');
        if (already) continue;

        const member = await Member.findById(m.memberId).lean();
        if (!member?.email) continue;
        await queueEmail({
          to: member.email,
          templateKey: 'expiryReminder',
          vars: {
            name: member.name,
            endDate: m.endDate,
          },
        });
        await Membership.findByIdAndUpdate(m._id, { lastReminderSentAt: new Date() });
      }
      logger.info(`Reminder cron processed ${list.length} memberships`);
    } catch (e) {
      logger.error('reminderCron', e);
    }
  });
}
