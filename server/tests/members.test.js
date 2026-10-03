import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREEZE_POLICY,
  buildTimeline,
  daysLeft,
  freezeOutcome,
  gymDaysBetween,
  membershipView,
  planFreeze,
  saleChangeType,
} from '../services/membershipService.js';
import { csvCell, joinedAtFromDay, memberListFilter, redactMemberDetail, toCsv } from '../services/memberService.js';
import { membershipNotice, membershipUpdateEmail } from '../services/membershipNotices.js';
import { sniffImageType } from '../services/storageService.js';

const DAY = 86_400_000;
/** Instant at a given IST wall-clock time. */
const ist = (s) => new Date(`${s}+05:30`);

test('gym days count calendar days in IST, not 24-hour blocks', () => {
  // 11:50 pm and 12:10 am IST are different gym days even though only 20 minutes apart.
  assert.equal(gymDaysBetween(ist('2026-03-01T23:50:00'), ist('2026-03-02T00:10:00')), 1);
  assert.equal(gymDaysBetween(ist('2026-03-02T00:10:00'), ist('2026-03-02T23:59:00')), 0);
  assert.equal(gymDaysBetween(ist('2026-03-10T09:00:00'), ist('2026-03-01T09:00:00')), -9);
  assert.equal(daysLeft(ist('2026-03-05T06:00:00'), ist('2026-03-01T22:00:00')), 4);
});

test('freeze: dates, starting now vs booked ahead', () => {
  const now = ist('2026-03-01T10:30:00');
  const membership = { status: 'active', endDate: ist('2026-03-20T10:30:00') };
  const today = planFreeze({ membership, days: 10, now });
  assert.equal(today.startDate.getTime(), ist('2026-03-01T00:00:00').getTime(), 'starts at the start of today');
  assert.equal(today.resumeDate.getTime(), ist('2026-03-11T00:00:00').getTime());
  assert.equal(today.newEndDate.getTime() - membership.endDate.getTime(), 10 * DAY);
  assert.equal(today.startsNow, true);

  const ahead = planFreeze({ membership, startDay: '2026-03-05', days: 3, now });
  assert.equal(ahead.startsNow, false);
  assert.equal(ahead.resumeDate.getTime(), ist('2026-03-08T00:00:00').getTime());
});

test('freeze: refused when it makes no sense', () => {
  const now = ist('2026-03-01T10:30:00');
  const active = { status: 'active', endDate: ist('2026-03-20T10:30:00') };
  const code = (fn) => {
    try {
      fn();
      return null;
    } catch (e) {
      return `${e.statusCode}:${e.code}:${Object.keys(e.details?.fields || {}).join(',')}`;
    }
  };
  assert.equal(code(() => planFreeze({ membership: { ...active, freeze: { days: 3 } }, days: 5, now })), '409:ALREADY_FROZEN:');
  assert.equal(code(() => planFreeze({ membership: { ...active, status: 'expired' }, days: 5, now })), '409:NOT_FREEZABLE:');
  assert.equal(code(() => planFreeze({ membership: { ...active, status: 'upcoming' }, days: 5, now })), '409:NOT_FREEZABLE:');
  assert.equal(code(() => planFreeze({ membership: active, startDay: '2026-02-28', days: 5, now })), '422:VALIDATION_ERROR:startDate');
  assert.equal(code(() => planFreeze({ membership: active, startDay: '2026-03-21', days: 5, now })), '422:VALIDATION_ERROR:startDate', 'plan has ended by then');
  assert.equal(code(() => planFreeze({ membership: active, startDay: '2026-03-20', days: 5, now })), null, 'the last day of the plan can still be frozen');
  assert.equal(code(() => planFreeze({ membership: { ...active, endDate: ist('2026-06-01T00:00:00') }, startDay: '2026-04-15', days: 5, now })), '422:VALIDATION_ERROR:startDate', 'too far ahead');
  assert.equal(code(() => planFreeze({ membership: active, days: 0, now })), '422:VALIDATION_ERROR:days');
  assert.equal(code(() => planFreeze({ membership: active, days: FREEZE_POLICY.maxDays + 1, now })), '422:VALIDATION_ERROR:days');
  assert.equal(code(() => planFreeze({ membership: active, days: FREEZE_POLICY.maxDays, now })), null);
});

test('unfreeze gives back exactly the unused gym days', () => {
  const freeze = { startDate: ist('2026-03-01T00:00:00'), endDate: ist('2026-03-11T00:00:00'), days: 10 };
  assert.deepEqual(freezeOutcome(freeze, ist('2026-03-01T18:00:00')), { daysFrozen: 0, unusedDays: 10, started: true }, 'same day');
  assert.deepEqual(freezeOutcome(freeze, ist('2026-03-04T07:00:00')), { daysFrozen: 3, unusedDays: 7, started: true });
  assert.deepEqual(freezeOutcome(freeze, freeze.endDate), { daysFrozen: 10, unusedDays: 0, started: true }, 'ran its course');
  assert.deepEqual(freezeOutcome(freeze, ist('2026-03-30T07:00:00')), { daysFrozen: 10, unusedDays: 0, started: true }, 'never more than booked');
  assert.deepEqual(freezeOutcome(freeze, ist('2026-02-27T07:00:00')), { daysFrozen: 0, unusedDays: 10, started: false }, 'removed before it started');
});

test('sale change type: join, renew, upgrade, downgrade', () => {
  const previous = { planId: 'p1', price: 1500 };
  assert.equal(saleChangeType({ isFirstPlan: true, previous: null, planId: 'p1', price: 1500 }), 'join');
  assert.equal(saleChangeType({ isFirstPlan: false, previous, planId: 'p1', price: 1200 }), 'renew', 'same plan, even at a discount');
  assert.equal(saleChangeType({ isFirstPlan: false, previous, planId: 'p2', price: 4000 }), 'upgrade');
  assert.equal(saleChangeType({ isFirstPlan: false, previous, planId: 'p2', price: 1500 }), 'upgrade', 'same price counts as an upgrade');
  assert.equal(saleChangeType({ isFirstPlan: false, previous, planId: 'p3', price: 999 }), 'downgrade');
  assert.equal(saleChangeType({ isFirstPlan: false, previous: null, planId: 'p3', price: 999 }), 'renew');
});

test('timeline: merges history and plans, newest first, filtered per audience', () => {
  const now = ist('2026-05-01T12:00:00');
  const memberships = [
    { _id: 'm1', planName: 'Monthly', price: 1500, status: 'expired', startDate: ist('2026-01-01T10:00:00'), endDate: ist('2026-01-31T10:00:00'), source: 'desk', createdBy: 'u1' },
    { _id: 'm2', planName: 'Quarterly', price: 4000, status: 'active', startDate: ist('2026-04-01T10:00:00'), endDate: ist('2026-06-30T10:00:00'), source: 'self' },
  ];
  const history = [
    // Legacy row: no source, no createdBy, no amount.
    { _id: 'h1', membershipId: 'm1', toPlanId: 'p1', changeType: 'join', changedAt: ist('2026-01-01T10:00:00') },
    { _id: 'h2', membershipId: 'm2', toPlanId: 'p2', fromPlanId: 'p1', changeType: 'upgrade', changedAt: ist('2026-03-30T10:00:00') },
    { _id: 'h3', membershipId: 'm2', toPlanId: 'p2', changeType: 'freeze', days: 7, notes: 'Knee surgery', source: 'desk', createdBy: 'u2', effectiveFrom: ist('2026-04-10T00:00:00'), effectiveTo: ist('2026-04-17T00:00:00'), changedAt: ist('2026-04-09T10:00:00') },
    { _id: 'h4', membershipId: 'm2', toPlanId: 'p2', changeType: 'unfreeze', days: 7, source: 'system', changedAt: ist('2026-04-17T01:00:00') },
  ];
  const users = new Map([['u1', 'Ravi'], ['u2', 'Meena']]);
  const planNames = new Map([['p1', 'Monthly'], ['p2', 'Quarterly']]);
  const staff = buildTimeline({ history, memberships, users, planNames, now });

  assert.deepEqual(staff.map((e) => e.type), ['unfreeze', 'freeze', 'upgrade', 'ended', 'join']);
  const join = staff.find((e) => e.type === 'join');
  assert.equal(join.by, 'Ravi', 'legacy sale falls back to whoever sold the plan');
  assert.equal(join.amount, 1500, 'legacy sale falls back to the plan price');
  const upgrade = staff.find((e) => e.type === 'upgrade');
  assert.equal(upgrade.by, 'Member (online)', 'plan requested in the app');
  assert.equal(upgrade.fromPlanName, 'Monthly');
  assert.equal(staff.find((e) => e.type === 'freeze').note, 'Knee surgery');
  assert.equal(staff.find((e) => e.type === 'freeze').by, 'Meena');
  assert.equal(staff.find((e) => e.type === 'unfreeze').by, 'Automatic');

  const trainer = buildTimeline({ history, memberships, users, planNames, now, includeMoney: false });
  assert.ok(trainer.every((e) => e.amount === undefined));
  const member = buildTimeline({ history, memberships, planNames, now, includeNotes: false });
  assert.ok(member.every((e) => e.note === undefined));
});

test('membership view for the member app', () => {
  const now = ist('2026-04-12T09:00:00');
  const m = {
    _id: 'm2', planId: 'p2', planName: 'Quarterly', price: 4000, status: 'paused', source: 'desk',
    startDate: ist('2026-04-01T10:00:00'), endDate: ist('2026-07-07T10:00:00'),
    freeze: { startDate: ist('2026-04-10T00:00:00'), endDate: ist('2026-04-17T00:00:00'), days: 7 },
  };
  const v = membershipView(m, { now });
  assert.equal(v.daysLeft, 86);
  assert.equal(v.totalDays, 97);
  assert.deepEqual(v.freeze, { startDate: m.freeze.startDate, resumeDate: m.freeze.endDate, days: 7, running: true });
  assert.equal(membershipView(m, { now, includePrice: false }).price, undefined);
  assert.equal(membershipView({ ...m, status: 'expired', freeze: undefined }, { now }).daysLeft, null);
  assert.equal(membershipView(null), null);
});

test('CSV cells: quoting and spreadsheet-formula defence', () => {
  assert.equal(csvCell('Asha'), 'Asha');
  assert.equal(csvCell('Sharma, Asha'), '"Sharma, Asha"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+919876543210'), "'+919876543210");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(0), '0');
  const csv = toCsv([{ header: 'Name', value: (r) => r.name }, { header: 'Dues', value: (r) => r.dues }], [{ name: 'राज', dues: 500 }]);
  assert.equal(csv, '﻿Name,Dues\r\nराज,500\r\n');
});

test('members list filter: joined range in gym days, trainer, search', () => {
  assert.deepEqual(memberListFilter({}), {});
  const f = memberListFilter({ joinedFrom: '2026-03-01', joinedTo: '2026-03-31', trainerId: 'none', q: 'asha' });
  const [search, from, to, trainer] = f.$and;
  assert.ok(search.$or.length >= 3);
  assert.equal(from.$expr.$gte[1].getTime(), ist('2026-03-01T00:00:00').getTime());
  assert.equal(to.$expr.$lt[1].getTime(), ist('2026-04-01T00:00:00').getTime(), 'the end day is included');
  assert.deepEqual(trainer, { assignedTrainerId: null });
  assert.equal(String(memberListFilter({ trainerId: '64b7f0c2a1b2c3d4e5f60718' }).$and[0].assignedTrainerId), '64b7f0c2a1b2c3d4e5f60718');
  assert.equal(joinedAtFromDay('2026-02-14').getTime(), ist('2026-02-14T00:00:00').getTime());
  assert.equal(joinedAtFromDay(undefined, ist('2026-02-14T23:30:00')).getTime(), ist('2026-02-14T00:00:00').getTime());
});

test('role redaction: trainers get no money, roles without health access get no health data', () => {
  const detail = () => ({
    member: { name: 'Asha', dues: 500 },
    profile: { weightKg: 60 },
    payments: [{ amount: 500 }],
    memberships: [{ planName: 'Monthly', price: 1500 }],
  });
  const trainer = redactMemberDetail(detail(), { money: false, health: true });
  assert.equal(trainer.member.dues, undefined);
  assert.deepEqual(trainer.payments, []);
  assert.equal(trainer.memberships[0].price, undefined);
  assert.equal(trainer.memberships[0].planName, 'Monthly');
  assert.equal(trainer.profile.weightKg, 60);
  assert.equal(redactMemberDetail(detail(), { money: true, health: false }).profile, null);
  assert.equal(redactMemberDetail(detail(), { money: true, health: true }).member.dues, 500);
});

test('photo type comes from the bytes', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  assert.equal(sniffImageType(png), 'image/png');
  assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])), 'image/jpeg');
  assert.equal(sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(sniffImageType(Buffer.from('GIF89a\0\0\0\0\0\0', 'latin1')), 'image/gif');
  assert.equal(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImageType(Buffer.from('%PDF-1.4 hello world')), null);
  assert.equal(sniffImageType(Buffer.from('tiny')), null);
});

test('member notices say what changed in plain words, and emails escape them', () => {
  const membership = { _id: 'm1', planName: 'Quarterly', status: 'paused', endDate: ist('2026-07-07T10:00:00') };
  const event = { _id: 'e1', effectiveFrom: ist('2026-04-10T00:00:00'), effectiveTo: ist('2026-04-17T00:00:00'), days: 3 };
  const frozen = membershipNotice('frozen', { membership, event });
  assert.equal(frozen.title, 'Your plan is on hold');
  assert.match(frozen.body, /from 10 Apr 2026 to 16 Apr 2026\. You can train again from 17 Apr 2026/);
  assert.match(frozen.body, /ends on 7 Jul 2026/);
  assert.match(membershipNotice('frozen', { membership: { ...membership, status: 'active' }, event }).title, /will be on hold from 10 Apr 2026/);
  assert.equal(membershipNotice('extended', { membership, event }).title, '3 days added to your plan');
  assert.equal(membershipNotice('unfrozen', { membership, event, endedHow: 'cancelled' }).title, 'Your planned freeze was removed');
  assert.throws(() => membershipNotice('nope', { membership, event }));
  const { html } = membershipUpdateEmail({ name: '<b>Asha</b>', heading: 'Hi', message: '<img src=x onerror=1>', gymName: 'Kovij' });
  assert.ok(!html.includes('<img src=x') && html.includes('&lt;img src=x') && html.includes('&lt;b&gt;Asha'));
});
