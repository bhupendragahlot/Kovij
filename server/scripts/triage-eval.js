/**
 * Measure automatic enquiry sorting against labelled examples. Calls the TypeSafe API; never
 * touches the database.
 *
 *   npm run triage:eval                                   # built-in made-up examples
 *   npm run triage:eval -- --file my-enquiries.jsonl      # your own (one JSON object per line)
 *
 * Each line: {"id":"…","message":"…","expect":{"topic":["fees"],"spam":false,"readiness":["browsing"],
 *   "plan":["Monthly"],"time":["evening"],"callback":true}}   (every expect key is optional)
 *
 * Use it to tune TRIAGE_POLICY in services/leadTriage.js before trusting automatic hiding.
 */
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { askSystemOne, isTypeSafeConfigured } from '../services/typesafe/client.js';
import { buildTriageRequest, deriveTriage } from '../services/leadTriage.js';

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));
const argFile = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null;
const file = argFile || path.join(here, '..', 'tests', 'fixtures', 'enquiries.jsonl');

if (!isTypeSafeConfigured()) {
  console.error('TYPESAFE_API_KEY is not set (add it to the .env in the project root).');
  process.exit(1);
}

// Representative plans; the real app uses the gym's active plans.
const PLANS = [
  { _id: 'monthly', name: 'Monthly', price: 1500, duration: 'month' },
  { _id: 'quarterly', name: 'Quarterly', price: 4000, duration: 'month', durationInDays: 90 },
  { _id: 'half', name: 'Half-yearly', price: 7000, duration: 'month', durationInDays: 180 },
  { _id: 'annual', name: 'Annual', price: 12000, duration: 'year' },
];
const planName = Object.fromEntries(PLANS.map((p) => [p._id, p.name]));

const rows = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l, i) => ({ id: `row-${i + 1}`, ...JSON.parse(l) }));

async function evaluate(row) {
  const { state, questions, planKeyToId } = buildTriageRequest({ message: row.message, plans: PLANS, gymName: 'Kovij Fitness Zone' });
  const t0 = Date.now();
  const { answers, usage } = await askSystemOne({ state, questions });
  const ms = Date.now() - t0;
  const got = deriveTriage(answers, planKeyToId);
  const actual = {
    topic: got.topic,
    spam: got.spam,
    readiness: got.readinessLevel,
    plan: got.planId ? planName[got.planId] : null,
    time: got.timePref,
    callback: got.wantsCallback,
  };
  const checks = {};
  for (const [field, want] of Object.entries(row.expect || {})) {
    checks[field] = Array.isArray(want) ? want.includes(actual[field]) : want === actual[field];
  }
  return { row, answers, got, actual, checks, ms, tokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0) };
}

// Small pool so a large file doesn't hit rate limits.
const results = [];
for (let i = 0; i < rows.length; i += 4) {
  results.push(...(await Promise.all(rows.slice(i, i + 4).map(evaluate))));
}

const pad = (s, n) => String(s ?? '—').slice(0, n).padEnd(n);
console.log(`\n${pad('id', 20)} ${pad('topic (conf)', 26)} ${pad('spam p', 7)} ${pad('ready', 17)} ${pad('plan', 12)} ${pad('time', 8)} call  result`);
for (const r of results) {
  const misses = Object.entries(r.checks).filter(([, ok]) => !ok).map(([f]) => f);
  console.log(
    `${pad(r.row.id, 20)} ${pad(`${r.actual.topic} (${r.got.topicConfidence})`, 26)} ${pad(r.got.spamProbability, 7)} ${pad(`${r.actual.readiness} ${r.got.readiness}`, 17)} ${pad(r.actual.plan, 12)} ${pad(r.actual.time, 8)} ${r.actual.callback ? 'yes ' : 'no  '}  ${misses.length ? `MISS ${misses.join(', ')}` : 'ok'}`
  );
}

const fields = ['topic', 'spam', 'readiness', 'plan', 'time', 'callback'];
console.log('\nAgreement with expected labels');
for (const f of fields) {
  const scored = results.filter((r) => f in r.checks);
  if (!scored.length) continue;
  const ok = scored.filter((r) => r.checks[f]).length;
  console.log(`  ${pad(f, 10)} ${ok}/${scored.length}`);
}
const spamRows = results.filter((r) => r.row.expect?.spam === false);
const falseHides = spamRows.filter((r) => r.got.spam).length;
console.log(`\nReal enquiries that would be hidden as spam: ${falseHides} of ${spamRows.length}`);
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
console.log(`Latency per enquiry: median ${ms[Math.floor(ms.length / 2)]} ms, max ${ms[ms.length - 1]} ms`);
console.log(`Tokens: ${results.reduce((s, r) => s + r.tokens, 0)} total for ${results.length} enquiries\n`);
