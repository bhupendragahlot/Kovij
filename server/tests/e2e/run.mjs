/**
 * API end-to-end suite: npm run test:e2e
 *
 * Starts a throwaway MongoDB replica set in memory, runs the real server against it from an
 * empty temp directory (so no .env is loaded: no real database, no real emails, no crons),
 * creates an admin, runs the core flows (flows.mjs) and every module flow (flows/*.mjs), and
 * tears everything down.
 *
 *   E2E_ONLY=attendance,workouts npm run test:e2e   # only these module flows ("core" = flows.mjs)
 *   E2E_PORT=4211 npm run test:e2e                  # run beside other suites without clashing
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTypeSafeStub } from './typesafeStub.mjs';
import { E2E_GOOGLE_CLIENT_ID, startGoogleStub } from './googleStub.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, '..', '..');
const PORT = process.env.E2E_PORT || '4199';
const SECRET = 'e2e-secret';

const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const typesafe = await startTypeSafeStub();
const google = await startGoogleStub();
const cwd = mkdtempSync(join(tmpdir(), 'kovij-e2e-'));
const env = {
  ...process.env,
  MONGO_URI: rs.getUri('kovij_test'),
  JWT_SECRET: SECRET,
  PORT,
  ENABLE_CRON: 'false',
  NODE_ENV: 'test',
  // Empty values win over any .env, so the email queue can never reach a real inbox.
  EMAIL_USER: '',
  EMAIL_PASS: '',
  // Enquiry sorting talks to a local stand-in, never the real TypeSafe API.
  TYPESAFE_API_KEY: 'e2e-typesafe-key',
  TYPESAFE_API_URL: `${typesafe.url}/v1/systemone`,
  // Many flows share one IP; limits are only switchable in NODE_ENV=test.
  DISABLE_RATE_LIMITS: 'true',
  // Push notifications must never reach real browsers from tests.
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  // Test-mode mobile sign-in (fixed code, no SMS); refused by the server in production.
  DEFAULT_OTP: '112233',
  // Sign in with Google: tokens are checked against a local stand-in for Google's keys.
  GOOGLE_CLIENT_ID: E2E_GOOGLE_CLIENT_ID,
  GOOGLE_CERTS_URL: google.certsUrl,
};

const only = (process.env.E2E_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const flowsDir = join(here, 'flows');
const moduleFlows = readdirSync(flowsDir, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.mjs'))
  .map((d) => d.name.replace(/\.mjs$/, ''))
  .sort();
const selected = [
  ...(!only.length || only.includes('core') ? [['core', join(here, 'flows.mjs')]] : []),
  ...moduleFlows.filter((name) => !only.length || only.includes(name)).map((name) => [name, join(flowsDir, `${name}.mjs`)]),
];

const run = (args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...env, ...opts.env }, stdio: opts.stdio || 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args[0]} exited with ${code}`))));
  });

let server;
let exitCode = 1;
let log = '';
try {
  await run([join(serverDir, 'scripts', 'create-admin.js'), '--email', 'owner@kovij.test', '--name', 'Raj Owner', '--password', 'owner-pass-123'], { stdio: 'ignore' });

  server = spawn(process.execPath, [join(serverDir, 'server.js')], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${log}`)), 60_000);
    const onData = (chunk) => {
      log += chunk;
      if (log.includes('Cron jobs disabled')) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.on('exit', (code) => reject(new Error(`server exited early (${code}):\n${log}`)));
  });

  const flowEnv = { E2E_API: `http://localhost:${PORT}/api`, E2E_JWT_SECRET: SECRET, E2E_TYPESAFE_STUB: typesafe.url, E2E_GOOGLE_KEY: google.privateKeyPem, E2E_GOOGLE_CLIENT_ID };
  const failures = [];
  for (const [name, file] of selected) {
    console.log(`\n── ${name} ──`);
    try {
      await run([file], { env: flowEnv });
    } catch {
      failures.push(name);
    }
  }
  if (failures.length) {
    console.log(`\nFailed flows: ${failures.join(', ')}\n\nLast server log lines:\n${log.split('\n').filter((l) => !/info: ::/.test(l)).slice(-40).join('\n')}`);
  } else {
    console.log(`\nAll ${selected.length} flow files passed.`);
    exitCode = 0;
  }
} catch (e) {
  console.error(e.message);
} finally {
  server?.kill();
  await typesafe.close();
  await google.close();
  await rs.stop();
  rmSync(cwd, { recursive: true, force: true });
}
process.exit(exitCode);
