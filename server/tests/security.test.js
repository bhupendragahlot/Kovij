import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeActivity, describeRoute, deviceLabel, fillSentence, pickResultFacts, routePattern } from '../services/activityService.js';
import { LOCKOUT, hashToken, lockoutState, passwordProblem } from '../services/staffAuthService.js';
import { settingsSchema } from '../validators/settings.schema.js';

const ID = '66f0c0ffee0c0ffee0c0ffee';
const ID2 = '66f0c0ffee0c0ffee0c0ff00';

test('route patterns hide ids and dates, and drop /api and the query', () => {
  assert.equal(routePattern(`/api/admin/members/${ID}/memberships/${ID2}/cancel?x=1`), '/admin/members/:id/memberships/:id/cancel');
  assert.equal(routePattern(`/api/admin/diets/members/${ID}/days/2026-09-30/water`), '/admin/diets/members/:id/days/:day/water');
  assert.equal(routePattern('/api/admin/members/'), '/admin/members');
});

test('known routes get their own wording; the member id comes from the path', () => {
  const sale = describeRoute('POST', `/api/admin/members/${ID}/memberships`);
  assert.equal(sale.action, 'membership.sell');
  assert.equal(sale.memberId, ID);
  assert.equal(fillSentence(sale.sentence, { member: 'Rahul Verma' }), 'sold a plan to Rahul Verma');

  const collect = describeRoute('POST', `/api/admin/payments/${ID2}/collect`);
  assert.equal(collect.kind, 'other');
  assert.equal(collect.entityId, ID2);
  assert.equal(collect.memberId, undefined);
});

test('unknown routes still read sensibly', () => {
  const d = describeRoute('DELETE', `/api/admin/widgets/${ID}`);
  assert.equal(d.action, 'widgets.delete');
  assert.equal(fillSentence(d.sentence), 'deleted a widget');
});

test('sentences drop unknown parts instead of printing blanks', () => {
  const s = 'collected a payment[ of {amount}][ from {member}]';
  assert.equal(fillSentence(s, { member: 'Rahul', amount: 1500 }), 'collected a payment of ₹1,500 from Rahul');
  assert.equal(fillSentence(s, { amount: 1500 }), 'collected a payment of ₹1,500');
  assert.equal(fillSentence(s), 'collected a payment');
  assert.equal(fillSentence('edited {member’s} details'), 'edited a member’s details');
  assert.equal(
    describeActivity({ actor: { name: 'Priya' }, action: 'payment.collect', amount: 1500, method: 'POST', route: '/admin/payments/:id/collect' }, { memberName: 'Rahul Verma' }),
    'Priya collected a payment of ₹1,500 from Rahul Verma'
  );
});

test('response facts: member and amount only, never the body', () => {
  assert.deepEqual(pickResultFacts({ success: true, payment: { _id: ID2, amount: 1500, memberId: ID, upiRef: 'secret' } }), { memberId: ID, amount: 1500, entityId: ID2 });
  assert.deepEqual(pickResultFacts({ success: true, member: { _id: ID, name: 'x' } }), { memberId: ID, amount: undefined, entityId: undefined });
  assert.deepEqual(pickResultFacts(null), {});
  assert.equal(pickResultFacts({ note: { memberId: 'not-an-id' } }).memberId, undefined);
});

test('device labels', () => {
  assert.equal(deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36'), 'Chrome on Android');
  assert.equal(deviceLabel('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/128 Safari/537.36 Edg/128'), 'Edge on Windows');
  assert.equal(deviceLabel(''), 'Unknown device');
});

const at = (minAgo, now) => new Date(now.getTime() - minAgo * 60_000);

test('sign-in lock: 5 wrong passwords in 15 minutes pause the account', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const fails = (mins) => mins.map((m) => ({ at: at(m, now), success: false, reason: 'wrong_password' }));

  assert.deepEqual(lockoutState(fails([1, 2, 3]), now), { locked: false, retryAfterMinutes: 0, attemptsLeft: 2 });
  const locked = lockoutState(fails([1, 2, 3, 4, 5]), now);
  assert.equal(locked.locked, true);
  assert.equal(locked.retryAfterMinutes, 10, 'unlocks when the 5th newest failure is 15 minutes old');
  // Old failures don't count.
  assert.equal(lockoutState(fails([1, 2, 3, 4, 20]), now).locked, false);
  // A successful sign-in (or reset) starts the count again.
  const withSuccess = [...fails([1, 2]), { at: at(3, now), success: true, reason: 'ok' }, ...fails([4, 5, 6])];
  assert.equal(lockoutState(withSuccess, now).locked, false);
  // Attempts made while locked don't extend the lock.
  const whileLocked = [{ at: at(0.5, now), success: false, reason: 'locked' }, ...fails([1, 2, 3, 4, 14])];
  assert.equal(lockoutState(whileLocked, now).retryAfterMinutes, 1);
  assert.equal(LOCKOUT.maxFailures, 5);
});

test('password rules', () => {
  assert.match(passwordProblem('short'), /at least 8/);
  assert.match(passwordProblem('priya@kovij.in', { email: 'Priya@kovij.in' }), /email/);
  assert.match(passwordProblem('priyadesk', { username: 'PriyaDesk' }), /username/);
  assert.match(passwordProblem('aaaaaaaaaa'), /repeat/);
  assert.match(passwordProblem('password'), /easy/);
  assert.equal(passwordProblem('Kota-front-desk-7'), null);
});

test('reset tokens are stored as hashes', () => {
  assert.equal(hashToken('abc').length, 64);
  assert.notEqual(hashToken('abc'), 'abc');
  assert.equal(hashToken('abc'), hashToken('abc'));
});

test('opening hours: overlaps, backwards times and empty open days are refused', () => {
  const hours = (slots, extra = {}) => settingsSchema.safeParse({ openingHours: [{ day: 1, closed: false, slots, ...extra }] });
  assert.equal(hours([{ open: '06:00', close: '11:00' }, { open: '16:00', close: '21:00' }]).success, true);
  assert.equal(hours([{ open: '11:00', close: '06:00' }]).success, false);
  assert.equal(hours([{ open: '06:00', close: '12:00' }, { open: '11:00', close: '21:00' }]).success, false);
  assert.equal(hours([]).success, false);
  assert.equal(hours([], { closed: true }).success, true);
  assert.equal(settingsSchema.safeParse({ openingHours: [{ day: 0, closed: true }, { day: 0, closed: true }] }).success, false);
  assert.equal(settingsSchema.safeParse({ holidays: [{ date: '2026-10-20', name: 'Diwali' }, { date: '2026-10-20', name: 'Again' }] }).success, false);
  assert.equal(settingsSchema.safeParse({ logoUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(settingsSchema.safeParse({ logoUrl: '/uploads/avatars/abc.jpg' }).success, true);
});
