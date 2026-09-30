/**
 * Sort website enquiries saved before automatic sorting existed, or whose sorting failed.
 *
 *   npm run triage:leads                 # newest 50 unsorted enquiries
 *   npm run triage:leads -- --limit 200
 *   npm run triage:leads -- --all
 *
 * Uses the database in .env (MONGO_URI), so it changes live leads: labels, priority, and an
 * empty "Interested in". It never deletes a lead and prints counts only, never message text.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import { triageLead, TRIAGE_VERSION } from '../services/leadTriage.js';
import { isTypeSafeConfigured } from '../services/typesafe/client.js';

dotenv.config();

const arg = (name) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : undefined);
const all = process.argv.includes('--all');
const limit = all ? 0 : Math.max(1, Number(arg('limit')) || 50);

if (!isTypeSafeConfigured()) {
  console.error('TYPESAFE_API_KEY is not set (add it to the .env in the project root).');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const filter = {
  message: { $exists: true, $ne: '' },
  $or: [{ 'triage.status': { $exists: false } }, { 'triage.status': 'failed' }, { 'triage.version': { $ne: TRIAGE_VERSION } }],
};
const ids = await Lead.find(filter).sort({ createdAt: -1 }).limit(limit).distinct('_id');
console.log(`Sorting ${ids.length} enquiries${all ? '' : ` (limit ${limit})`}…`);

const tally = { done: 0, failed: 0, skipped: 0 };
for (const [i, id] of ids.entries()) {
  tally[await triageLead(id, { force: true })] += 1;
  if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${ids.length}`);
}

const summary = await Lead.aggregate([
  { $match: { _id: { $in: ids }, 'triage.status': 'done' } },
  { $group: { _id: { topic: '$triage.topic', spam: '$triage.spam' }, n: { $sum: 1 } } },
  { $sort: { n: -1 } },
]);
console.log(`\nDone ${tally.done}, failed ${tally.failed}, skipped ${tally.skipped}`);
for (const row of summary) console.log(`  ${row._id.spam ? 'likely spam' : row._id.topic}: ${row.n}`);
await mongoose.disconnect();
