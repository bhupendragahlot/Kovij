import cron from 'node-cron';
import Membership from '../models/Membership.js';
import Member from '../models/Member.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { rollOverMemberships } from '../services/membershipService.js';
import { logger } from '../utils/logger.js';
import { GYM_TZ } from '../utils/time.js';

/** 01:00 gym time: expire ended plans, start queued renewals, and email members whose plan lapsed. */
export async function runExpiryJob(now = new Date()) {
  const toNotify = await Membership.find({ status: 'active', endDate: { $lt: now } }).select('memberId').lean();
  const { expired, started } = await rollOverMemberships(now);

  // Don't send "your plan ended" to someone whose renewal just started.
  const renewed = new Set(
    (await Membership.distinct('memberId', { status: 'active', memberId: { $in: toNotify.map((m) => m.memberId) } })).map(String)
  );
  const settings = await getSettingsDoc();
  for (const m of toNotify) {
    if (renewed.has(String(m.memberId))) continue;
    const member = await Member.findById(m.memberId).select('email name').lean();
    if (!member?.email) continue;
    await queueEmail({ to: member.email, templateKey: 'expired', vars: { name: member.name, gymName: settings.gymName } });
    await Membership.findByIdAndUpdate(m._id, { lastNotifiedAt: new Date() });
  }
  logger.info(`Expiry job: ${expired} expired, ${started} renewals started`);
}

export function startExpiryCron() {
  cron.schedule(
    '0 1 * * *',
    () => runExpiryJob().catch((e) => logger.error(`expiryCron: ${e.message}`)),
    { timezone: GYM_TZ }
  );
}
