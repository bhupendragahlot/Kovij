import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToKey,
  birthdayKey,
  birthdayMonthDays,
  daysBetween,
  expiryDedupeKey,
  expirySkipReason,
  expiryStage,
  isBirthdayToday,
  nextScheduledRun,
  normalizeReminderSettings,
  paymentDueDecision,
  paymentDueKey,
  reminderMessage,
  scheduledRunDecision,
} from '../services/reminderRules.js';
import {
  announcementEmail,
  memberMessageEmail,
  reminderExpirySoonEmail,
  reminderPaymentDueEmail,
} from '../services/emailTemplates/engagementEmails.js';
import { buildPushPayload, isAllowedPushEndpoint } from '../services/pushChannel.js';
import { createAnnouncementSchema, pushSubscribeSchema, reminderSettingsSchema } from '../validators/engagement.schema.js';

/** A moment in gym time (IST, +05:30). */
const ist = (local) => new Date(`${local}+05:30`);
const settings = normalizeReminderSettings({ expiryDaysBefore: [7, 3, 1], onExpiryDay: true, afterExpiryDays: [3, 7] });

/** A 30-day plan ending at `end` (IST local string), started 30 days earlier. */
function plan(end, over = {}) {
  const endDate = ist(end);
  return { _id: 'm1', status: 'active', durationDays: 30, startDate: new Date(endDate.getTime() - 30 * 86_400_000), endDate, ...over };
}

test('settings: defaults filled, days de-duplicated, sorted and clamped', () => {
  assert.deepEqual(normalizeReminderSettings(undefined), {
    enabled: true,
    expiryDaysBefore: [1, 3, 7],
    onExpiryDay: true,
    afterExpiryDays: [3, 7],
    paymentDue: true,
    paymentDueEveryDays: 3,
    birthday: true,
    sendHour: 9,
  });
  const s = normalizeReminderSettings({ expiryDaysBefore: [3, 3, 0, 7, 99], afterExpiryDays: [], sendHour: 30, paymentDueEveryDays: 0 });
  assert.deepEqual(s.expiryDaysBefore, [3, 7]);
  assert.deepEqual(s.afterExpiryDays, [], 'an empty list means "off", not "defaults"');
  assert.equal(s.sendHour, 21);
  assert.equal(s.paymentDueEveryDays, 1);
});

test('day arithmetic works on calendar keys', () => {
  assert.equal(daysBetween('2026-02-27', '2026-03-01'), 2);
  assert.equal(daysBetween('2028-02-27', '2028-03-01'), 3, 'leap year');
  assert.equal(addDaysToKey('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysToKey('2026-01-01', -1), '2025-12-31');
});

test('expiry: reminders fire exactly N days before, on the day, and N days after', () => {
  const now = ist('2026-10-01T09:05:00');
  assert.deepEqual(expiryStage(plan('2026-10-08T14:00:00'), now, settings), { stage: 'before', days: 7 });
  assert.deepEqual(expiryStage(plan('2026-10-02T06:00:00'), now, settings), { stage: 'before', days: 1 });
  assert.equal(expiryStage(plan('2026-10-06T14:00:00'), now, settings), null, '5 days is not a configured stage');
  assert.deepEqual(expiryStage(plan('2026-10-01T20:00:00'), now, settings), { stage: 'today', days: 0 });
  assert.deepEqual(expiryStage(plan('2026-10-01T02:00:00', { status: 'expired' }), now, settings), { stage: 'today', days: 0 });
  assert.deepEqual(expiryStage(plan('2026-09-28T14:00:00', { status: 'expired' }), now, settings), { stage: 'after', days: 3 });
  // Housekeeping hasn't run yet: an active plan whose end passed still counts as ended.
  assert.deepEqual(expiryStage(plan('2026-09-24T14:00:00'), now, settings), { stage: 'after', days: 7 });
});

test('expiry: no reminders for cancelled plans, turned-off stages, short plans, or plans bought today', () => {
  const now = ist('2026-10-01T09:05:00');
  assert.equal(expiryStage(plan('2026-09-28T14:00:00', { status: 'cancelled' }), now, settings), null);
  assert.equal(expiryStage(plan('2026-10-08T14:00:00'), now, { ...settings, expiryDaysBefore: [3, 1] }), null);
  assert.equal(expiryStage(plan('2026-10-01T20:00:00'), now, { ...settings, onExpiryDay: false }), null);
  assert.equal(expiryStage(plan('2026-10-02T08:00:00', { durationDays: 1 }), now, settings), null, 'day pass');
  // A 7-day plan bought this morning ends in 7 days: no "ends in 7 days" on the day of purchase.
  const weekly = { _id: 'w', status: 'active', durationDays: 7, startDate: ist('2026-10-01T08:00:00'), endDate: ist('2026-10-08T08:00:00') };
  assert.equal(expiryStage(weekly, now, settings), null);
  assert.deepEqual(expiryStage(weekly, ist('2026-10-05T09:05:00'), settings), { stage: 'before', days: 3 });
});

test('expiry: day boundaries follow gym time, not UTC', () => {
  const m = plan('2026-03-18T01:30:00'); // 17 Mar 20:00 UTC
  // 00:15 IST on 11 Mar is still 10 Mar in UTC, but it is the 11th at the gym: 7 days to go.
  assert.deepEqual(expiryStage(m, new Date('2026-03-10T18:45:00Z'), settings), { stage: 'before', days: 7 });
  // 23:45 IST on 10 Mar: 8 days to go, not a stage.
  assert.equal(expiryStage(m, new Date('2026-03-10T18:15:00Z'), settings), null);
});

test('expiry: skipped when the member already renewed or has a newer plan', () => {
  const current = { _id: 'a', status: 'active', endDate: ist('2026-10-08T10:00:00') };
  assert.equal(expirySkipReason('before', current, [current]), null);
  assert.equal(expirySkipReason('before', current, [current, { _id: 'b', status: 'upcoming', endDate: ist('2026-11-07T10:00:00') }]), 'renewed');
  assert.equal(expirySkipReason('today', current, [current, { _id: 'b', status: 'pending', endDate: ist('2026-11-07T10:00:00') }]), 'renewed');
  // Switched plans today: the old one "ends today" but a new active plan runs longer.
  assert.equal(expirySkipReason('today', { ...current, status: 'expired' }, [{ ...current, status: 'expired' }, { _id: 'c', status: 'active', endDate: ist('2026-12-30T10:00:00') }]), 'renewed');

  const ended = { _id: 'a', status: 'expired', endDate: ist('2026-09-28T10:00:00') };
  assert.equal(expirySkipReason('after', ended, [ended]), null);
  assert.equal(expirySkipReason('after', ended, [ended, { _id: 'b', status: 'active', endDate: ist('2026-10-28T10:00:00') }]), 'renewed');
  assert.equal(expirySkipReason('after', ended, [ended, { _id: 'b', status: 'expired', endDate: ist('2026-09-30T10:00:00') }]), 'newer_plan');
  assert.equal(expirySkipReason('after', ended, [ended, { _id: 'b', status: 'cancelled', endDate: ist('2026-10-30T10:00:00') }]), null);
});

test('dedupe keys are stable per membership and stage', () => {
  assert.equal(expiryDedupeKey('before', 'm1', 7), 'expiry:m1:7d');
  assert.equal(expiryDedupeKey('today', 'm1', 0), 'expiry:m1:0d');
  assert.equal(expiryDedupeKey('after', 'm1', 3), 'expired:m1:3d');
  assert.equal(paymentDueKey('p1', 3, 0), 'due:p1:3d:0');
  assert.equal(birthdayKey('u1', ist('2026-05-10T09:00:00')), 'birthday:u1:2026');
  // 31 Dec 20:00 UTC is already 1 Jan at the gym.
  assert.equal(birthdayKey('u1', new Date('2026-12-31T20:00:00Z')), 'birthday:u1:2027');
});

test('payment due: first reminder after a day, then every N days, capped', () => {
  const created = ist('2026-10-01T18:00:00');
  const at = (day) => ist(`${day}T09:05:00`);
  const decide = (day, lastSentDay, everyDays = 3) => paymentDueDecision({ anchorCreatedAt: created, lastSentDay, now: at(day), everyDays });
  assert.deepEqual(decide('2026-10-01'), { send: false, reason: 'too_new' });
  assert.deepEqual(decide('2026-10-02'), { send: true, bucket: 0 });
  assert.deepEqual(decide('2026-10-02', '2026-10-02'), { send: false, reason: 'sent_today', bucket: 0 }, 'a second run the same day reports "already sent"');
  assert.equal(decide('2026-10-03', '2026-10-02').reason, 'too_soon');
  assert.deepEqual(decide('2026-10-05', '2026-10-02'), { send: true, bucket: 1 });
  // A missed day catches up within the same bucket, and spacing still holds afterwards.
  assert.deepEqual(decide('2026-10-06', '2026-10-02'), { send: true, bucket: 1 });
  assert.equal(decide('2026-10-08', '2026-10-06').reason, 'too_soon');
  assert.equal(decide('2026-10-20').reason, 'max_reached');
  // The owner switches to weekly: no reminder until 7 days after the last one.
  assert.equal(decide('2026-10-08', '2026-10-05', 7).reason, 'too_soon');
  assert.equal(decide('2026-10-12', '2026-10-05', 7).send, true);
});

test('birthdays: matched in gym time, with 29 Feb celebrated on 28 Feb in other years', () => {
  const utcMidnight = new Date('1990-05-10T00:00:00Z'); // how a YYYY-MM-DD form value is stored
  const istMidnight = new Date('1990-05-09T18:30:00Z'); // how a device in India may send it
  assert.equal(isBirthdayToday(utcMidnight, ist('2026-05-10T09:00:00')), true);
  assert.equal(isBirthdayToday(istMidnight, ist('2026-05-10T09:00:00')), true);
  assert.equal(isBirthdayToday(utcMidnight, new Date('2026-05-09T20:00:00Z')), true, '01:30 IST on the 10th');
  assert.equal(isBirthdayToday(utcMidnight, new Date('2026-05-10T19:00:00Z')), false, '00:30 IST on the 11th');
  assert.equal(isBirthdayToday(null, new Date()), false);

  const leapling = new Date('1992-02-29T00:00:00Z');
  assert.equal(isBirthdayToday(leapling, ist('2027-02-28T09:00:00')), true);
  assert.equal(isBirthdayToday(leapling, ist('2028-02-28T09:00:00')), false, 'leap year has its own 29th');
  assert.equal(isBirthdayToday(leapling, ist('2028-02-29T09:00:00')), true);
  assert.equal(isBirthdayToday(leapling, ist('2027-03-01T09:00:00')), false);
  assert.deepEqual(birthdayMonthDays(ist('2027-02-28T09:00:00')), [{ month: 2, day: 28 }, { month: 2, day: 29 }]);
  assert.deepEqual(birthdayMonthDays(ist('2028-02-28T09:00:00')), [{ month: 2, day: 28 }]);
});

test('schedule: runs once a day at or after the send hour, catching up until 9 pm', () => {
  const s = normalizeReminderSettings({ sendHour: 9 });
  const at = (t, doneToday = false, over = {}) => scheduledRunDecision({ now: ist(`2026-10-01T${t}`), settings: { ...s, ...over }, doneToday });
  assert.equal(at('08:05:00').reason, 'before_send_hour');
  assert.equal(at('09:05:00').run, true);
  assert.equal(at('14:05:00').run, true, 'server was asleep at 9: catch up');
  assert.equal(at('14:05:00', true).reason, 'done_today');
  assert.equal(at('22:05:00').reason, 'too_late');
  assert.equal(at('09:05:00', false, { enabled: false }).reason, 'disabled');
  // The server clock zone is irrelevant: 03:35 UTC is 09:05 at the gym.
  assert.equal(scheduledRunDecision({ now: new Date('2026-10-01T03:35:00Z'), settings: s, doneToday: false }).run, true);

  assert.equal(nextScheduledRun({ now: ist('2026-10-01T07:00:00'), settings: s, doneToday: false }).toISOString(), ist('2026-10-01T09:05:00').toISOString());
  assert.equal(nextScheduledRun({ now: ist('2026-10-01T10:00:00'), settings: s, doneToday: true }).toISOString(), ist('2026-10-02T09:05:00').toISOString());
  assert.equal(nextScheduledRun({ now: ist('2026-10-01T10:00:00'), settings: { ...s, enabled: false }, doneToday: false }), null);
});

test('reminder wording is short and specific', () => {
  const end = ist('2026-10-08T14:00:00');
  assert.equal(reminderMessage('before', { days: 1, planName: 'Monthly', endDate: end }).title, 'Your plan ends tomorrow');
  const soon = reminderMessage('before', { days: 7, planName: 'Monthly', endDate: end, gymName: 'Kovij' });
  assert.equal(soon.title, 'Your plan ends in 7 days');
  assert.match(soon.body, /Monthly plan at Kovij ends on 8 Oct 2026/);
  assert.equal(soon.link, '/member/membership');
  assert.equal(soon.preference, null, 'plan reminders cannot be turned off');
  const due = reminderMessage('due', { amount: 2500 });
  assert.equal(due.title, 'Payment due: ₹2,500');
  assert.equal(due.link, '/member/payments');
  const bday = reminderMessage('birthday', { memberName: 'Riya Sharma', gymName: 'Kovij' });
  assert.equal(bday.title, 'Happy birthday, Riya!');
  assert.equal(bday.preference, 'birthday');
});

test('emails escape every value and keep subjects on one line', () => {
  const soon = reminderExpirySoonEmail({ name: '<b>Ravi</b>', planName: 'Gold <script>', endDate: ist('2026-10-08T10:00:00'), days: 3, renewPrice: 1500, gymName: 'Kovij' });
  assert.ok(!soon.html.includes('<script>'));
  assert.ok(soon.html.includes('&lt;b&gt;Ravi&lt;/b&gt;'));
  assert.match(soon.html, /₹1,500/);
  assert.match(soon.html, /Renew my plan/);
  assert.equal(soon.subject, 'Your Kovij plan ends in 3 days');

  const due = reminderPaymentDueEmail({ name: 'Ravi', amount: 2000, items: [{ label: 'Registration fee', amount: 500 }, { label: 'Membership', amount: 1500 }] });
  assert.match(due.html, /Total due/);
  assert.match(due.subject, /₹2,000 due/);

  const news = announcementEmail({ title: 'Diwali\nhours', body: 'Line one\nLine two\n\n<img src=x onerror=1>', imageUrl: 'javascript:alert(1)' });
  assert.ok(!news.subject.includes('\n'));
  assert.ok(!news.html.includes('javascript:'), 'only https images are embedded');
  assert.ok(news.html.includes('&lt;img src=x onerror=1&gt;'));
  assert.ok(news.html.includes('Line one<br>Line two'));

  const msg = memberMessageEmail({ name: 'Asha', subject: 'Hi\r\nBcc: x@y.z', body: '<a href="http://evil">x</a>' });
  assert.equal(msg.subject, 'Hi Bcc: x@y.z');
  assert.ok(!msg.html.includes('<a href="http://evil">'));
});

test('push: only real push services are accepted, and links stay in the app', () => {
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/abc'), true);
  assert.equal(isAllowedPushEndpoint('https://wns2-bn3p.notify.windows.com/w/?token=abc'), true);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.com/x', 'https://fcm.googleapis.com:8443/x', 'not a url']) {
    assert.equal(isAllowedPushEndpoint(bad), false, bad);
  }
  const payload = JSON.parse(buildPushPayload({ _id: 'n1', kind: 'payment_due', title: 'Due', body: 'x', link: '//evil.com/x' }));
  assert.equal(payload.url, '/member/dashboard');
  assert.equal(payload.tag, 'payment_due');
  assert.equal(JSON.parse(buildPushPayload({ title: 't', link: '/member/payments' })).url, '/member/payments');
});

test('validation: reminder settings, push subscriptions, announcement dates', () => {
  assert.deepEqual(reminderSettingsSchema.parse({ expiryDaysBefore: [7, 1, 3, 7] }).expiryDaysBefore, [1, 3, 7]);
  assert.equal(reminderSettingsSchema.safeParse({ expiryDaysBefore: [0] }).success, false);
  assert.equal(reminderSettingsSchema.safeParse({ expiryDaysBefore: [1, 2, 3, 4, 5, 6, 7] }).success, false);
  assert.equal(reminderSettingsSchema.safeParse({ sendHour: 5 }).success, false);
  assert.equal(reminderSettingsSchema.safeParse({ sendhour: 9 }).success, false, 'unknown fields are rejected');
  assert.equal(reminderSettingsSchema.safeParse({}).success, false);

  const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
  assert.equal(pushSubscribeSchema.safeParse({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys } }).success, true);
  assert.equal(pushSubscribeSchema.safeParse({ subscription: { endpoint: 'https://example.com/hook', keys } }).success, false);

  const draft = createAnnouncementSchema.parse({ title: 'Diwali hours', body: 'Closed on 1 Nov', publishAt: null });
  assert.equal(draft.publishAt, null, 'null must not become 1 Jan 1970');
  assert.equal(draft.category, 'notice');
  assert.equal(draft.audience, 'all');
  assert.equal(createAnnouncementSchema.safeParse({ title: 'x', body: 'y', imageUrl: 'http://insecure.example/a.png' }).success, false);
  assert.equal(createAnnouncementSchema.safeParse({ title: 'two\nlines', body: 'y' }).success, false);
});
