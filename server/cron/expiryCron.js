import cron from 'node-cron';
import Membership from '../models/Membership.js';
import Member from '../models/Member.js';
import { queueEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';

export function startExpiryCron() {
  cron.schedule('0 1 * * *', async () => {
    try {
      const now = new Date();
      const expiredList = await Membership.find({
        status: 'active',
        endDate: { $lt: now },
      }).lean();

      await Membership.updateMany(
        { status: 'active', endDate: { $lt: now } },
        { $set: { status: 'expired' } }
      );

      for (const m of expiredList) {
        const member = await Member.findById(m.memberId).lean();
        if (!member?.email) continue;
        await queueEmail({
          to: member.email,
          templateKey: 'expired',
          vars: { name: member.name },
        });
        await Membership.findByIdAndUpdate(m._id, { lastNotifiedAt: new Date() });
      }
      logger.info(`Expiry cron marked ${expiredList.length} memberships expired`);
    } catch (e) {
      logger.error('expiryCron', e);
    }
  });
}
