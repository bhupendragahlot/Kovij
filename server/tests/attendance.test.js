import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQrToken, looksLikeQrToken, qrSigningKey, verifyQrToken } from '../services/qrToken.js';
import {
  ATTENDANCE_POLICY,
  addDaysToKey,
  closingMinute,
  computeStreak,
  csvCell,
  decideScanAction,
  evaluateEntry,
  isOpenDay,
  isPastClosing,
  isValidDayKey,
  isValidMonthKey,
  membershipSummary,
  monthDays,
  monthsEndingAt,
  toCsv,
  visitMinutes,
  visitStatus,
  weekdayOfKey,
} from '../services/attendanceRules.js';

const KEY = qrSigningKey({ QR_SECRET: 'unit-test-qr-secret-1234567890' });
const MEMBER = '64b7f0c2a1b2c3d4e5f60718';

// ── QR codes

test('QR code round-trips member id and version, and stays short enough to scan easily', () => {
  const token = createQrToken({ memberId: MEMBER, version: 3 }, KEY);
  assert.ok(looksLikeQrToken(token));
  assert.ok(token.length <= 50, `token is ${token.length} chars`);
  assert.deepEqual(verifyQrToken(token, KEY), { ok: true, memberId: MEMBER, version: 3 });
  assert.deepEqual(verifyQrToken(`  ${token}\n`, KEY).ok, true, 'scanner whitespace is ignored');
});

test('QR codes cannot be forged, edited or moved to another member', () => {
  const token = createQrToken({ memberId: MEMBER, version: 1 }, KEY);
  const [prefix, id, ver, sig] = token.split('.');
  const other = createQrToken({ memberId: '64b7f0c2a1b2c3d4e5f60719', version: 1 }, KEY).split('.')[1];
  assert.equal(verifyQrToken(`${prefix}.${other}.${ver}.${sig}`, KEY).reason, 'signature', 'swapped member id');
  assert.equal(verifyQrToken(`${prefix}.${id}.2.${sig}`, KEY).reason, 'signature', 'bumped version');
  const flipped = sig[0] === 'A' ? `B${sig.slice(1)}` : `A${sig.slice(1)}`;
  assert.equal(verifyQrToken(`${prefix}.${id}.${ver}.${flipped}`, KEY).reason, 'signature', 'edited signature');
  const otherKey = qrSigningKey({ QR_SECRET: 'a-different-secret-for-another-gym' });
  assert.equal(verifyQrToken(token, otherKey).ok, false, 'signed with another key');
  for (const junk of ['', 'hello', 'KV1.', 'KV1.a.b.c', `KV2.${id}.${ver}.${sig}`, `${token}.extra`, null]) {
    assert.equal(verifyQrToken(junk, KEY).ok, false, String(junk));
  }
});

test('QR key: QR_SECRET wins; otherwise derived from JWT_SECRET (not the JWT secret itself); neither throws', () => {
  const a = qrSigningKey({ QR_SECRET: 'qr-secret-value-long-enough', JWT_SECRET: 'jwt' });
  assert.equal(a.toString(), 'qr-secret-value-long-enough');
  const derived = qrSigningKey({ JWT_SECRET: 'jwt-secret' });
  assert.notEqual(derived.toString(), 'jwt-secret');
  assert.deepEqual(derived, qrSigningKey({ JWT_SECRET: 'jwt-secret' }), 'derivation is stable');
  assert.throws(() => qrSigningKey({}));
  assert.throws(() => createQrToken({ memberId: 'not-an-id' }, KEY));
  assert.throws(() => createQrToken({ memberId: MEMBER, version: 0 }, KEY));
});

// ── Entry rules

const on = (iso) => new Date(iso);

test('only an active plan walks straight in; every refusal says why', () => {
  assert.deepEqual(evaluateEntry({ name: 'Priya', standing: { state: 'active', membership: {} } }), { allowed: true });
  const none = evaluateEntry({ name: 'Priya', standing: { state: 'none', membership: null } });
  assert.equal(none.allowed, false);
  assert.equal(none.message, 'Priya has no plan yet');
  const ended = evaluateEntry({ name: 'Priya', standing: { state: 'expired', membership: { endDate: on('2026-09-03T10:00:00Z') } } });
  assert.equal(ended.reason, 'Plan ended on 3 Sep 2026');
  const pending = evaluateEntry({ name: 'Priya', standing: { state: 'pending', membership: {} } });
  assert.match(pending.message, /waiting for payment/);
  const upcoming = evaluateEntry({ name: 'Priya', standing: { state: 'upcoming', membership: { startDate: on('2026-10-01T00:00:00+05:30') } } });
  assert.equal(upcoming.reason, 'Plan starts on 1 Oct 2026');
  const off = evaluateEntry({ name: 'Priya', memberActive: false, standing: { state: 'active', membership: {} } });
  assert.equal(off.allowed, false, 'a turned-off profile is refused even with a plan');
});

test('a paused plan is refused with "On hold until <last day on hold>"', () => {
  // The freeze ends at the start of 12 Oct (gym time): the member is on hold through 11 Oct.
  const standing = { state: 'paused', membership: { pauseEndsAt: on('2026-10-12T00:00:00+05:30') } };
  const verdict = evaluateEntry({ name: 'Priya', standing });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'On hold until 11 Oct 2026');
  assert.equal(verdict.message, "Priya's plan is on hold until 11 Oct 2026");
  const viaFreeze = evaluateEntry({ name: 'Priya', standing: { state: 'paused', membership: { freeze: { endDate: on('2026-10-12T00:00:00+05:30') } } } });
  assert.equal(viaFreeze.reason, 'On hold until 11 Oct 2026');
  assert.equal(evaluateEntry({ name: 'Priya', standing: { state: 'paused', membership: {} } }).reason, 'On hold');
  assert.deepEqual(membershipSummary(standing, on('2026-10-01T06:00:00Z')).pausedUntil, standing.membership.pauseEndsAt);
});

test('days left count gym days: 0 on the last day, negative after', () => {
  const now = on('2026-09-30T18:00:00Z'); // 11:30 pm IST, 30 Sep
  const summary = (end) => membershipSummary({ state: 'active', membership: { planName: 'Monthly', endDate: on(end) } }, now).daysLeft;
  assert.equal(summary('2026-10-01T02:00:00Z'), 1, 'ends 1 Oct IST');
  assert.equal(summary('2026-09-30T10:00:00Z'), 0, 'ends today');
  assert.equal(summary('2026-09-28T10:00:00Z'), -2);
});

// ── Scans

const visit = (over = {}) => ({ dayKey: '2026-09-30', checkedInAt: on('2026-09-30T01:00:00Z'), checkedOutAt: null, minutesInGym: 0, ...over });

test('scan in auto mode: in, then out only after the minimum stay, then back in', () => {
  const t0 = on('2026-09-30T01:00:00Z');
  const later = (min) => new Date(t0.getTime() + min * 60_000);
  const gap = ATTENDANCE_POLICY.autoCheckOutAfterMinutes;
  assert.equal(decideScanAction(null, { mode: 'auto', now: t0 }), 'check_in');
  assert.equal(decideScanAction(visit(), { mode: 'auto', now: later(1) }), 'already_in', 'double scan at the door');
  assert.equal(decideScanAction(visit(), { mode: 'auto', now: later(gap - 1) }), 'already_in');
  assert.equal(decideScanAction(visit(), { mode: 'auto', now: later(gap) }), 'check_out');
  assert.equal(decideScanAction(visit({ checkedOutAt: later(60) }), { mode: 'auto', now: later(300) }), 'return');
  // The minimum stay counts from the latest return, not the first check-in.
  assert.equal(decideScanAction(visit({ lastInAt: later(300) }), { mode: 'auto', now: later(305) }), 'already_in');
});

test('scan in explicit modes', () => {
  const now = on('2026-09-30T02:00:00Z');
  assert.equal(decideScanAction(null, { mode: 'out', now }), 'not_in');
  assert.equal(decideScanAction(visit(), { mode: 'out', now }), 'check_out');
  assert.equal(decideScanAction(visit({ checkedOutAt: now }), { mode: 'out', now }), 'already_out');
  assert.equal(decideScanAction(visit(), { mode: 'in', now }), 'already_in');
  assert.equal(decideScanAction(visit({ checkedOutAt: now }), { mode: 'in', now }), 'return');
});

// ── Visit status and opening hours

const HOURS = [
  { day: 0, closed: true, slots: [] },
  ...[1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: false, slots: [{ open: '06:00', close: '11:00' }, { open: '16:00', close: '21:00' }] })),
];

test('closing time comes from the last session of the day; unknown or odd hours never close a visit', () => {
  assert.equal(closingMinute(HOURS, 3), 21 * 60);
  assert.equal(closingMinute(HOURS, 0), null, 'closed day');
  assert.equal(closingMinute([{ day: 3, slots: [{ open: '22:00', close: '02:00' }] }], 3), null, 'overnight slot ignored');
  assert.equal(closingMinute([], 3), null);
  // Wednesday 30 Sep 2026, gym time.
  assert.equal(isPastClosing(on('2026-09-30T15:50:00Z'), HOURS), false, '9:20 pm: within the grace period');
  assert.equal(isPastClosing(on('2026-09-30T16:05:00Z'), HOURS), true, '9:35 pm');
  assert.equal(isPastClosing(on('2026-09-30T16:05:00Z'), []), false, 'no hours configured');
});

test('a visit without a check-out is shown as missing, never given a made-up time', () => {
  const ctx = { todayKey: '2026-09-30', pastClosing: false };
  assert.equal(visitStatus(visit(), ctx), 'in');
  assert.equal(visitStatus(visit(), { ...ctx, pastClosing: true }), 'no_check_out');
  assert.equal(visitStatus(visit({ dayKey: '2026-09-29' }), ctx), 'no_check_out');
  assert.equal(visitStatus(visit({ checkedOutAt: on('2026-09-30T02:00:00Z'), minutesInGym: 60 }), ctx), 'out');
  assert.equal(visitMinutes(visit()), null);
  assert.equal(visitMinutes(visit({ checkedOutAt: on('2026-09-30T02:00:00Z'), minutesInGym: 61.6 })), 62);
});

test('open days honour weekly hours and holidays', () => {
  const settings = { openingHours: HOURS, holidays: [{ date: '2026-10-20', name: 'Dussehra' }] };
  assert.equal(weekdayOfKey('2026-10-04'), 0, 'Sunday');
  assert.equal(isOpenDay('2026-10-04', settings), false);
  assert.equal(isOpenDay('2026-10-05', settings), true);
  assert.equal(isOpenDay('2026-10-20', settings), false, 'holiday');
  assert.equal(isOpenDay('2026-10-04', {}), true, 'unknown hours count as open');
});

// ── Streaks

test('streak counts consecutive open days; closed days and an unfinished today never break it', () => {
  const settings = { openingHours: HOURS, holidays: [] };
  const isOpen = (k) => isOpenDay(k, settings);
  // Wed 30 Sep is today. Visits Sat 26, Mon 28, Tue 29 (Sun 27 closed). Today not yet visited.
  const visited = new Set(['2026-09-26', '2026-09-28', '2026-09-29']);
  assert.deepEqual(computeStreak(visited, { todayKey: '2026-09-30', isOpen, lookbackDays: 30 }), { current: 3, longest: 3 });
  visited.add('2026-09-30');
  assert.equal(computeStreak(visited, { todayKey: '2026-09-30', isOpen, lookbackDays: 30 }).current, 4);
  // A missed open day breaks the current streak but the longest run is remembered.
  const gap = new Set(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-29']);
  assert.deepEqual(computeStreak(gap, { todayKey: '2026-09-30', isOpen, lookbackDays: 30 }), { current: 1, longest: 4 });
  assert.deepEqual(computeStreak(new Set(), { todayKey: '2026-09-30', isOpen, lookbackDays: 30 }), { current: 0, longest: 0 });
});

// ── Calendar keys

test('calendar keys: real days only, month lengths, leap years, month ranges', () => {
  assert.equal(isValidDayKey('2026-02-28'), true);
  assert.equal(isValidDayKey('2026-02-30'), false);
  assert.equal(isValidDayKey('2026-9-30'), false);
  assert.equal(isValidMonthKey('2026-13'), false);
  assert.equal(isValidMonthKey('2026-09'), true);
  assert.equal(monthDays('2028-02').length, 29);
  assert.equal(monthDays('2026-02').at(-1), '2026-02-28');
  assert.equal(addDaysToKey('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToKey('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(monthsEndingAt('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

// ── CSV

test('CSV escapes quotes, commas and line breaks, and defuses spreadsheet formulas', () => {
  assert.equal(csvCell('Priya'), 'Priya');
  assert.equal(csvCell('Sharma, Priya'), '"Sharma, Priya"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell('=HYPERLINK("http://x")'), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell(-5), '-5', 'numbers are left alone');
  assert.equal(csvCell(null), '');
  const csv = toCsv([{ header: 'Name', value: (r) => r.name }, { header: 'Visits', value: (r) => r.n }], [{ name: 'प्रिया', n: 3 }]);
  assert.ok(csv.startsWith('\uFEFFName,Visits\r\n'), 'BOM so Excel reads Hindi names');
  assert.ok(csv.includes('प्रिया,3'));
});
