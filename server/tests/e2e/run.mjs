/**
 * API end-to-end suite: npm run test:e2e
 *
 * Starts a throwaway MongoDB replica set in memory, runs the real server against it from an
 * empty temp directory (so no .env is loaded: no real database, no real emails, no crons),
 * creates an admin, runs flows.mjs, and tears everything down.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTypeSafeStub } from './typesafeStub.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, '..', '..');
const PORT = process.env.E2E_PORT || '4199';
const SECRET = 'e2e-secret';

const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
const typesafe = await startTypeSafeStub();
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
};

const run = (args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...env, ...opts.env }, stdio: opts.stdio || 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args[0]} exited with ${code}`))));
  });

let server;
let exitCode = 1;
try {
  await run([join(serverDir, 'scripts', 'create-admin.js'), '--email', 'owner@kovij.test', '--name', 'Raj Owner', '--password', 'owner-pass-123'], { stdio: 'ignore' });

  server = spawn(process.execPath, [join(serverDir, 'server.js')], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
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

  await run([join(here, 'flows.mjs')], {
    env: { E2E_API: `http://localhost:${PORT}/api`, E2E_JWT_SECRET: SECRET, E2E_TYPESAFE_STUB: typesafe.url },
  });
  exitCode = 0;
} catch (e) {
  console.error(e.message);
} finally {
  server?.kill();
  await typesafe.close();
  await rs.stop();
  rmSync(cwd, { recursive: true, force: true });
}
process.exit(exitCode);
