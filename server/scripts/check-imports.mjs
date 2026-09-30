/**
 * Fast "does the server still load?" check. Imports every route, the cron runner and the
 * migrations without connecting to a database or starting a listener.
 *
 *   node server/scripts/check-imports.mjs
 *
 * Run it after every backend change: several modules are edited at once and one half-written
 * file stops the server for everyone.
 */
process.env.JWT_SECRET ||= 'check-imports';
const targets = ['../routes/index.js', '../cron/cronRunner.js', '../migrations/index.js', '../services/notify.js'];
let failed = 0;
for (const t of targets) {
  try {
    await import(new URL(t, import.meta.url));
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${t}\n  ${e.stack?.split('\n').slice(0, 4).join('\n  ')}`);
  }
}
console.log(failed ? `${failed} import failure(s)` : 'server modules load');
process.exit(failed ? 1 : 0);
