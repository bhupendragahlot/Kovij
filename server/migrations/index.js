import Migration from '../models/Migration.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import Lead from '../models/Lead.js';
import Trainer from '../models/Trainer.js';
import Settings from '../models/Settings.js';
import { canonicalPhone } from '../utils/strings.js';
import { getSettingsDoc } from '../models/Settings.js';
import { nextSequence } from '../models/Counter.js';
import { parsePlanPrice } from '../services/membershipService.js';
import { logger } from '../utils/logger.js';
import { fileExists } from '../services/fileStore.js';
import { avatarKey } from '../services/storageService.js';

async function dropLegacyIndex(Model, name) {
  const indexes = await Model.collection.indexes().catch(() => []);
  const legacy = indexes.find((i) => i.name === name && !i.partialFilterExpression);
  if (legacy) {
    await Model.collection.dropIndex(name);
    logger.info(`migration: dropped legacy index ${Model.modelName}.${name}`);
  }
}

/**
 * Each step runs once (tracked in the `migrations` collection) and is safe to re-run.
 * Order matters: later steps can rely on earlier ones.
 */
const STEPS = [
  {
    id: '2026-09-partial-unique-indexes',
    // Walk-in members have no firebaseUid/email; the old unique indexes treated every
    // missing value as a duplicate. Replace them with partial unique indexes.
    async run() {
      await dropLegacyIndex(Member, 'firebaseUid_1');
      await dropLegacyIndex(Member, 'email_1');
      await dropLegacyIndex(Payment, 'invoiceNo_1');
      await Member.syncIndexes();
      await Payment.syncIndexes();
    },
  },
  {
    id: '2026-09-plan-price-number',
    async run() {
      const rows = await Plan.collection.find({ price: { $type: 'string' } }).toArray();
      for (const row of rows) {
        await Plan.collection.updateOne({ _id: row._id }, { $set: { price: parsePlanPrice(row) } });
      }
      if (rows.length) logger.info(`migration: converted ${rows.length} plan prices to numbers`);
    },
  },
  {
    id: '2026-09-canonical-phones',
    // Phones were stored as typed; store one form so duplicates and searches match.
    async run() {
      for (const collection of [Member.collection, Lead.collection]) {
        const rows = await collection.find({ phone: { $type: 'string' } }, { projection: { phone: 1 } }).toArray();
        for (const row of rows) {
          const next = canonicalPhone(row.phone);
          if (next !== row.phone) await collection.updateOne({ _id: row._id }, next ? { $set: { phone: next } } : { $unset: { phone: '' } });
        }
      }
    },
  },
  {
    id: '2026-09-member-codes',
    async run() {
      const settings = await getSettingsDoc();
      const cursor = Member.find({ memberCode: { $exists: false } }).sort({ createdAt: 1 }).select('_id').cursor();
      let n = 0;
      for await (const m of cursor) {
        const seq = await nextSequence('member');
        await Member.updateOne({ _id: m._id }, { $set: { memberCode: `${settings.invoicePrefix || 'KFZ'}-${String(seq).padStart(4, '0')}` } });
        n += 1;
      }
      if (n) logger.info(`migration: assigned member codes to ${n} members`);
    },
  },
  {
    // Leads created before automatic sorting get the neutral priority, so list ordering is consistent.
    id: '2026-10-lead-priority',
    async run() {
      await Lead.updateMany({ priority: { $exists: false } }, { $set: { priority: 2 } });
    },
  },
  {
    // Uploads used to be saved on the server's disk, which the host wipes on every deploy and
    // restart, so older logo and photo links point at files that no longer exist (the app showed
    // a broken image). Uploads now live in the database; forget only the links whose file is gone,
    // so screens, emails and receipts fall back to the Kovij mark or initials until re-uploaded.
    id: '2026-10-forget-lost-uploads',
    async run() {
      const keyFor = (url) => avatarKey(url) || (typeof url === 'string' && url.startsWith('/uploads/members/') ? `members/${url.split('/').pop()}` : null);
      const lost = async (url) => {
        const key = keyFor(url);
        return Boolean(key) && !(await fileExists(key));
      };
      const settings = await Settings.findOne().select('logoUrl').lean();
      if (settings && (await lost(settings.logoUrl))) {
        await Settings.updateOne({ _id: settings._id }, { $set: { logoUrl: '' } });
        logger.warn('migration: the gym logo file was lost; upload it again under Settings');
      }
      let trainers = 0;
      const ours = { $regex: '^/uploads/' };
      for (const t of await Trainer.find({ image: ours }).select('image').lean()) {
        if (!(await lost(t.image))) continue;
        await Trainer.updateOne({ _id: t._id }, { $set: { image: '' } });
        trainers += 1;
      }
      let members = 0;
      for await (const m of Member.find({ profilePhoto: ours }).select('profilePhoto').lean().cursor()) {
        if (!(await lost(m.profilePhoto))) continue;
        await Member.updateOne({ _id: m._id }, { $set: { profilePhoto: '' } });
        members += 1;
      }
      if (trainers || members) logger.warn(`migration: forgot lost photos (${trainers} trainers, ${members} members)`);
    },
  },
];

export async function runStartupMigrations() {
  for (const step of STEPS) {
    if (await Migration.exists({ _id: step.id })) continue;
    try {
      await step.run();
      await Migration.create({ _id: step.id });
      logger.info(`migration: ${step.id} done`);
    } catch (e) {
      // Leave it unmarked so it retries on the next boot; the app keeps serving.
      logger.error(`migration: ${step.id} failed: ${e.message}`);
    }
  }
}
