import Migration from '../models/Migration.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import Lead from '../models/Lead.js';
import { canonicalPhone } from '../utils/strings.js';
import { getSettingsDoc } from '../models/Settings.js';
import { nextSequence } from '../models/Counter.js';
import { parsePlanPrice } from '../services/membershipService.js';
import { logger } from '../utils/logger.js';

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
