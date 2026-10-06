/**
 * Shared helpers for module e2e flows (server/tests/e2e/flows/*.mjs).
 *
 *   import { call, check, adminToken, staffToken, memberToken, uniq, finish } from '../lib.mjs';
 *   const T = await adminToken();
 *   const r = await call('POST', '/admin/expenses', { token: T, body: {...} });
 *   check('create expense', r.status === 201, r.body);
 *   finish();                       // prints results, exits non-zero on any failure
 *
 * Flows share one database and run one after another, so never assume it is empty:
 * create your own data and name it with uniq() so assertions can't collide with other flows.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

export const API = process.env.E2E_API || 'http://localhost:4199/api';
export const ORIGIN = API.replace(/\/api$/, '');
const SECRET = process.env.E2E_JWT_SECRET || 'e2e-secret';

const results = [];
let failed = 0;

export function check(name, cond, extra = '') {
  if (!cond) failed += 1;
  const detail = typeof extra === 'string' ? extra : JSON.stringify(extra);
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  ${detail.slice(0, 600)}`}`);
}

export const key = () => crypto.randomUUID().replace(/-/g, '');

let counter = 0;
/** Unique suffix for names/emails/phones created by this flow. */
export const uniq = (prefix = 'x') => `${prefix}${process.pid}${Date.now().toString(36)}${counter++}`;
/** A unique, valid 10-digit Indian mobile number. */
export const uniqPhone = () => `9${String(Date.now() + counter++ * 7919).slice(-9)}`;

export async function call(method, path, { body, token, idem, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined && !(body instanceof FormData)) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (idem) h['Idempotency-Key'] = idem;
  const res = await fetch(API + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, body: json, text: raw ? text : undefined, headers: res.headers };
}

export async function adminToken() {
  const r = await call('POST', '/auth/login', { body: { email: 'owner@kovij.test', password: 'owner-pass-123' } });
  if (!r.body?.token) throw new Error(`admin login failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

/** Create (as admin) and sign in a staff account with the given role. */
export async function staffToken(role = 'staff', adminT) {
  const T = adminT || (await adminToken());
  const email = `${uniq(role)}@kovij.test`;
  const password = 'pass-word-123';
  const created = await call('POST', '/admin/staff', { token: T, body: { name: `Test ${role}`, username: uniq(role), email, role, password } });
  if (created.status !== 201) throw new Error(`create ${role} failed: ${JSON.stringify(created.body)}`);
  const r = await call('POST', '/auth/login', { body: { email, password } });
  return { token: r.body.token, user: r.body.user };
}

/** A member-app token for an existing member id (signed like the real member session). */
export const memberToken = (memberId) => jwt.sign({ memberId: String(memberId), type: 'member', role: 'user' }, SECRET, { expiresIn: '1h' });

/** Register a desk member (optionally with an active plan) and return { member, token }. */
/**
 * A date of birth for test registrations (required at the desk). About six months from today, so
 * it never makes a birthday reminder fire during a test run.
 */
export function testDob(now = new Date()) {
  const d = new Date(now.getTime() + 182 * 86_400_000);
  const md = d.toISOString().slice(5, 10);
  return `1990-${md === '02-29' ? '02-28' : md}`;
}

export async function createMember(adminT, { planId, collect = 'now', name, dob } = {}) {
  const body = { details: { name: name || uniq('Member '), phone: uniqPhone(), email: `${uniq('m')}@example.com`, dob: dob || testDob() }, force: true };
  if (planId) body.membership = { planId, payment: collect === 'now' ? { collect: 'now', mode: 'cash' } : { collect: 'later' } };
  const r = await call('POST', '/admin/members', { token: adminT, body, idem: key() });
  if (r.status !== 201) throw new Error(`create member failed: ${JSON.stringify(r.body)}`);
  return { member: r.body.member, sale: r.body.sale, token: memberToken(r.body.member._id) };
}

/** Create an active plan and return it. */
export async function createPlan(adminT, overrides = {}) {
  const r = await call('POST', '/plans', { token: adminT, body: { name: uniq('Plan '), price: 1500, duration: 'month', ...overrides } });
  if (r.status !== 201) throw new Error(`create plan failed: ${JSON.stringify(r.body)}`);
  return r.body;
}

export function finish() {
  console.log(results.join('\n'));
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
  // Let fetch's sockets finish closing first: exiting mid-close crashes Node on Windows
  // (libuv "UV_HANDLE_CLOSING" assertion). The timer only fires if something keeps the process up.
  setTimeout(() => process.exit(process.exitCode), 3000).unref();
}
