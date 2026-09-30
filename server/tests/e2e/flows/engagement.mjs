// Engagement: automatic reminders (expiry, come back, payment due, birthday), announcements,
// member inbox and preferences, web push subscriptions, staff messages, permissions, idempotency.
import { adminToken, call, check, createPlan, finish, key, memberToken, staffToken, uniq, uniqPhone } from '../lib.mjs';

const T = await adminToken();
const trainer = await staffToken('trainer', T);
const desk = await staffToken('staff', T);
const manager = await staffToken('manager', T);
const M = manager.token;

const gymDay = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const addDays = (dayKey, n) => new Date(Date.parse(`${dayKey}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** 09:05 at the gym on that day: just after the default send hour. */
const at = (dayKey, time = '09:05:00') => new Date(`${dayKey}T${time}+05:30`).toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value || Date.now() > end) return value;
    await sleep(250);
  }
}
const today = gymDay();

/** Register a member at the desk; `plan` sells a plan (paid now unless collect: 'later'). */
async function member({ planId, collect = 'now', email = true, dob } = {}) {
  const details = { name: uniq('Eng '), phone: uniqPhone(), ...(email && { email: `${uniq('eng')}@example.com` }), ...(dob && { dob }) };
  const body = { details, force: true };
  if (planId) body.membership = { planId, payment: collect === 'now' ? { collect: 'now', mode: 'cash' } : { collect: 'later' } };
  const r = await call('POST', '/admin/members', { token: T, body, idem: key() });
  if (r.status !== 201) throw new Error(`create member failed: ${JSON.stringify(r.body)}`);
  return { id: r.body.member._id, member: r.body.member, sale: r.body.sale, token: memberToken(r.body.member._id) };
}
const testRun = (now, memberIds, jobs = ['reminders']) => call('POST', '/admin/reminders/test/run', { token: M, body: { now, jobs, memberIds } });
const inbox = async (m, q = '') => (await call('GET', `/member/notifications${q}`, { token: m.token })).body;

// ── Permissions ──────────────────────────────────────────────────────────────
const somebody = await member();
for (const [method, path, body] of [
  ['GET', '/admin/reminders/overview'],
  ['GET', '/admin/reminders/preview'],
  ['POST', '/admin/reminders/run', {}],
  ['PATCH', '/admin/reminders/settings', { sendHour: 10 }],
  ['GET', '/admin/reminders/history'],
  ['GET', '/admin/notifications'],
  ['GET', '/admin/announcements'],
  ['POST', '/admin/announcements', { title: 'x', body: 'y' }],
]) {
  check(`trainer cannot ${method} ${path} (403)`, (await call(method, path, { token: trainer.token, body, idem: key() })).status === 403);
  check(`front desk cannot ${method} ${path} (403)`, (await call(method, path, { token: desk.token, body, idem: key() })).status === 403);
}
check('trainer cannot message members (403)', (await call('POST', '/admin/notifications/messages', { token: trainer.token, idem: key(), body: { memberId: somebody.id, title: 'Hi', body: 'x' } })).status === 403);
check('trainer cannot see a member’s message channels (403)', (await call('GET', `/admin/notifications/members/${somebody.id}`, { token: trainer.token })).status === 403);
check('member token cannot reach staff reminders (403)', (await call('GET', '/admin/reminders/overview', { token: somebody.token })).status === 403);
check('staff token cannot read a member inbox (401)', (await call('GET', '/member/notifications', { token: M })).status === 401);
check('inbox needs sign-in (401)', (await call('GET', '/member/notifications')).status === 401);

// ── Reminder settings (managers can change them) ─────────────────────────────
let r = await call('PATCH', '/admin/reminders/settings', { token: M, body: { expiryDaysBefore: [0] } });
check('reminder days must be 1 or more (422, field error)', r.status === 422 && Boolean(r.body.details?.fields?.['expiryDaysBefore.0']), r.body);
r = await call('PATCH', '/admin/reminders/settings', { token: M, body: { sendHour: 3 } });
check('send hour must be 6 am–9 pm (422)', r.status === 422 && Boolean(r.body.details?.fields?.sendHour), r.body);
r = await call('PATCH', '/admin/reminders/settings', { token: M, body: { sendHuor: 9 } });
check('unknown setting is rejected (422)', r.status === 422, r.body);
r = await call('PATCH', '/admin/reminders/settings', {
  token: M,
  body: { enabled: true, expiryDaysBefore: [7, 1, 3, 7], onExpiryDay: true, afterExpiryDays: [3], paymentDue: true, paymentDueEveryDays: 3, birthday: true, sendHour: 9 },
});
check('manager saves reminder settings (days de-duplicated and sorted)', r.status === 200 && JSON.stringify(r.body.reminders.expiryDaysBefore) === '[1,3,7]' && r.body.reminders.sendHour === 9, r.body);
const settingsAfter = await call('GET', '/admin/settings', { token: T });
check('saved reminder settings keep the rest of settings', settingsAfter.body.settings.reminders.paymentDueEveryDays === 3 && Array.isArray(settingsAfter.body.settings.openingHours), settingsAfter.body.settings.reminders);

r = await call('GET', '/admin/reminders/overview', { token: M });
check(
  'overview reports settings, next run and channel readiness',
  r.status === 200 && r.body.settings.enabled === true && r.body.channels.email === false && r.body.channels.push === false && Boolean(r.body.nextRunAt) && r.body.scheduler === false,
  r.body
);

// ── Members for the reminder rules ───────────────────────────────────────────
const plan = await createPlan(T, { duration: 'month', price: 1500 });
const A = await member({ planId: plan._id }); // plain active member
const B = await member({ planId: plan._id }); // renews early
const C = await member({ planId: plan._id, collect: 'later' }); // owes money
const E = await member({ planId: plan._id, email: false }); // no email on file
const D = await member({ planId: plan._id, dob: today }); // birthday today
const F = await member({ planId: plan._id, dob: today }); // birthday, opted out
r = await call('POST', `/admin/members/${B.id}/memberships`, { token: T, idem: key(), body: { planId: plan._id, payment: { collect: 'now', mode: 'upi' } } });
check('B renews early (queued renewal)', r.status === 201 || r.status === 200, r.body);

const endKey = gymDay(A.sale.membership.endDate);
const sevenBefore = addDays(endKey, -7);

// 7 days before the end: A and E are reminded, B (renewed) is not.
r = await testRun(at(sevenBefore), [A.id, B.id, E.id]);
check('7-day reminders: A and E get one, B is skipped (renewed)', r.status === 200 && r.body.reminders.byKind.expiry_reminder?.sent === 2 && r.body.reminders.totals.skipped >= 1, r.body);
r = await testRun(at(sevenBefore), [A.id, B.id, E.id]);
check('running the same day again sends nothing twice', r.status === 200 && r.body.reminders.totals.sent === 0 && r.body.reminders.byKind.expiry_reminder?.alreadySent === 2, r.body);
r = await testRun(at(addDays(endKey, -6)), [A.id]);
check('6 days before is not a reminder day', r.status === 200 && r.body.reminders.totals.sent === 0, r.body);
r = await testRun(at(endKey), [A.id]);
check('A gets "ends today" on the last day', r.status === 200 && r.body.reminders.byKind.expiry_today?.sent === 1, r.body);
r = await testRun(at(addDays(endKey, 3)), [A.id, B.id]);
check('3 days after: A gets "come back"; B has a current plan and does not', r.status === 200 && r.body.reminders.byKind.come_back?.sent === 1, r.body);

let box = await inbox(A);
const kinds = box.items.map((n) => n.kind);
check('A’s inbox has the 7-day, last-day and come-back messages', ['expiry_reminder', 'expiry_today', 'come_back'].every((k) => kinds.includes(k)), kinds);
const sevenDay = box.items.find((n) => n.kind === 'expiry_reminder');
check('reminder text names the plan and links to renewal', sevenDay?.title === 'Your plan ends in 7 days' && sevenDay.body.includes(plan.name) && sevenDay.link === '/member/membership', sevenDay);
check('inbox items do not expose internal keys or channel data', sevenDay && sevenDay.dedupeKey === undefined && sevenDay.channels === undefined, sevenDay);
const bBox = await inbox(B);
check('B (renewed) got no expiry messages', !bBox.items.some((n) => ['expiry_reminder', 'come_back'].includes(n.kind)), bBox.items.map((n) => n.kind));

// E has no email: still reminded in the app, email reported as skipped.
r = await call('GET', `/admin/reminders/history?memberId=${E.id}`, { token: M });
const eItem = r.body.items?.find((n) => n.kind === 'expiry_reminder');
check('history shows E’s reminder with email skipped (no email on file)', r.status === 200 && eItem?.channels?.email?.status === 'skipped' && eItem.channels.email.reason === 'no_email', r.body);
// A has an email: the queue fails in tests (no SMTP), and that outcome reaches the notification.
const aFailed = await waitFor(async () => {
  const h = await call('GET', `/admin/reminders/history?memberId=${A.id}&kind=expiry_reminder`, { token: M });
  const item = h.body.items?.[0];
  return item?.channels?.email?.status === 'failed' ? item : null;
}, 20000);
check('email outcome is tracked on the notification (failed: SMTP not configured)', Boolean(aFailed) && /not configured/i.test(aFailed.channels.email.reason), aFailed);
check('push reported as not configured', aFailed?.channels?.push?.status === 'skipped' && aFailed.channels.push.reason === 'push_not_configured', aFailed?.channels);

// Payment due: first reminder the day after, then every 3 days.
r = await testRun(at(today), [C.id]);
check('no payment reminder on the day the due was created', r.status === 200 && !r.body.reminders.byKind.payment_due, r.body);
r = await testRun(at(addDays(today, 1)), [C.id]);
check('payment reminder the next day', r.status === 200 && r.body.reminders.byKind.payment_due?.sent === 1, r.body);
r = await testRun(at(addDays(today, 1), '15:00:00'), [C.id]);
check('same day again: already sent', r.status === 200 && r.body.reminders.byKind.payment_due?.alreadySent === 1 && r.body.reminders.totals.sent === 0, r.body);
r = await testRun(at(addDays(today, 2)), [C.id]);
check('2 days later: too soon for another', r.status === 200 && r.body.reminders.totals.sent === 0, r.body);
r = await testRun(at(addDays(today, 4)), [C.id]);
check('after 3 more days: second reminder', r.status === 200 && r.body.reminders.byKind.payment_due?.sent === 1, r.body);
box = await inbox(C);
const dues = box.items.filter((n) => n.kind === 'payment_due');
check('C has two payment reminders linking to payments', dues.length === 2 && dues[0].title.startsWith('Payment due: ₹') && dues[0].link === '/member/payments', dues);

// Birthdays: once per year; opting out means no message at all.
r = await call('PATCH', '/member/notifications/preferences', { token: F.token, body: { birthday: false } });
check('member turns off birthday wishes', r.status === 200 && r.body.preferences.birthday === false, r.body);
r = await testRun(at(today), [D.id, F.id], ['preview']);
check('preview: D gets a birthday wish, F is skipped (opted out)', r.status === 200 && r.body.preview.items.some((i) => i.kind === 'birthday' && i.member._id === D.id) && r.body.preview.skippedByReason.opted_out >= 1, r.body.preview);
r = await testRun(at(today), [D.id, F.id]);
check('birthday wish sent once', r.status === 200 && r.body.reminders.byKind.birthday?.sent === 1, r.body);
r = await testRun(at(today, '18:00:00'), [D.id, F.id]);
check('birthday not repeated the same year', r.status === 200 && r.body.reminders.byKind.birthday?.alreadySent === 1 && r.body.reminders.totals.sent === 0, r.body);
check('F received no birthday message', !(await inbox(F)).items.some((n) => n.kind === 'birthday'));

// Preview of a later day shows what already went out.
r = await call('GET', `/admin/reminders/preview?date=${sevenBefore}`, { token: M });
const previewA = r.body.items?.find((i) => i.member._id === A.id);
check('preview of a later day marks A’s 7-day reminder as already sent', r.status === 200 && previewA?.status === 'already_sent' && previewA.kind === 'expiry_reminder', previewA || r.body);
check('preview rejects past days (422)', (await call('GET', `/admin/reminders/preview?date=${addDays(today, -1)}`, { token: M })).status === 422);
check('preview rejects days too far ahead (422)', (await call('GET', `/admin/reminders/preview?date=${addDays(today, 45)}`, { token: M })).status === 422);

// "Send now" is idempotent, locked against overlap, and respects the off switch.
check('send now needs an Idempotency-Key (400)', (await call('POST', '/admin/reminders/run', { token: M })).status === 400);
const runKey = key();
const run1 = await call('POST', '/admin/reminders/run', { token: M, idem: runKey });
check('manager runs reminders now', run1.status === 200 && run1.body.run?.status === 'done' && typeof run1.body.run.totals.sent === 'number', run1.body);
const replay = await call('POST', '/admin/reminders/run', { token: M, idem: runKey });
check('retrying with the same key replays the result', replay.status === 200 && replay.headers.get('idempotent-replayed') === 'true' && replay.body.run._id === run1.body.run._id, replay.body);
const run2 = await call('POST', '/admin/reminders/run', { token: M, idem: key() });
check('a second run today finds everything already sent (birthday included)', run2.status === 200 && run2.body.run.totals.sent === 0 && run2.body.run.totals.alreadySent >= 1, run2.body);
const [p1, p2] = await Promise.all([call('POST', '/admin/reminders/run', { token: M, idem: key() }), call('POST', '/admin/reminders/run', { token: T, idem: key() })]);
check('overlapping runs: one runs, the other is told to wait or finds nothing new', [p1.status, p2.status].includes(200) && [p1, p2].every((x) => x.status === 200 || x.body?.code === 'REMINDERS_RUNNING'), [p1.body, p2.body]);
check('the two overlapping runs sent nothing twice', [p1, p2].every((x) => x.status !== 200 || x.body.run.totals.sent === 0), [p1.body, p2.body]);
await call('PATCH', '/admin/reminders/settings', { token: M, body: { enabled: false } });
r = await call('POST', '/admin/reminders/run', { token: M, idem: key() });
check('reminders turned off: send now is refused with a reason (409)', r.status === 409 && r.body.code === 'REMINDERS_OFF', r.body);
await call('PATCH', '/admin/reminders/settings', { token: M, body: { enabled: true } });

r = await call('GET', '/admin/reminders/stats?days=30', { token: M });
const stat = (k) => r.body.kinds?.find((x) => x.kind === k)?.total || 0;
check('stats count reminders per stage', r.status === 200 && stat('expiry_reminder') >= 2 && stat('payment_due') >= 2 && stat('birthday') >= 1, r.body);
r = await call('GET', '/admin/reminders/overview', { token: M });
check('overview shows the last run', r.status === 200 && Boolean(r.body.lastRun) && Array.isArray(r.body.recentRuns), r.body);

// ── Member inbox ─────────────────────────────────────────────────────────────
box = await inbox(A);
check('inbox is paginated with an unread count', box.success && box.total >= 3 && box.page === 1 && box.unread >= 3, box);
const first = box.items[0];
r = await call('POST', `/member/notifications/${first._id}/read`, { token: A.token });
check('member marks one read', r.status === 200 && Boolean(r.body.notification.readAt) && r.body.unread === box.unread - 1, r.body);
const readAt = r.body.notification.readAt;
r = await call('POST', `/member/notifications/${first._id}/read`, { token: A.token });
check('marking read again keeps the first read time', r.status === 200 && r.body.notification.readAt === readAt, r.body);
const cItem = (await inbox(C)).items[0];
check('a member cannot mark someone else’s notification (404)', (await call('POST', `/member/notifications/${cItem._id}/read`, { token: A.token })).status === 404);
check('unread filter works', (await inbox(A, '?unread=true')).items.every((n) => !n.readAt));
r = await call('POST', '/member/notifications/read-all', { token: A.token });
check('mark all read', r.status === 200 && r.body.updated >= 1, r.body);
check('unread count is zero', (await call('GET', '/member/notifications/unread-count', { token: A.token })).body.unread === 0);
check('inbox page size is capped (422)', (await call('GET', '/member/notifications?limit=500', { token: A.token })).status === 422);

// ── Preferences ──────────────────────────────────────────────────────────────
r = await call('GET', '/member/notifications/preferences', { token: A.token });
check('preferences default to on and say what can’t be turned off', r.status === 200 && Object.values(r.body.preferences).every(Boolean) && r.body.alwaysOn.includes('payment_reminders'), r.body);
check('preferences need real booleans (422)', (await call('PATCH', '/member/notifications/preferences', { token: A.token, body: { email: 'no' } })).status === 422);
check('empty preference update is rejected (422)', (await call('PATCH', '/member/notifications/preferences', { token: A.token, body: {} })).status === 422);
check('unknown preference is rejected (422)', (await call('PATCH', '/member/notifications/preferences', { token: A.token, body: { sms: true } })).status === 422);

// ── Web push subscriptions ───────────────────────────────────────────────────
r = await call('GET', '/member/notifications/push/key', { token: A.token });
check('push key endpoint says push is not set up (no VAPID keys in tests)', r.status === 200 && r.body.configured === false && r.body.publicKey === '', r.body);
const subscription = { endpoint: `https://fcm.googleapis.com/fcm/send/${uniq('e2e')}`, expirationTime: null, keys: { p256dh: `B${'x'.repeat(86)}`, auth: 'a'.repeat(22) } };
r = await call('POST', '/member/notifications/push/subscribe', { token: A.token, body: { subscription: { ...subscription, endpoint: 'https://169.254.169.254/latest/meta-data' } } });
check('push endpoints outside the browser push services are refused (422)', r.status === 422 && Boolean(r.body.details?.fields?.['subscription.endpoint']), r.body);
r = await call('POST', '/member/notifications/push/subscribe', { token: A.token, body: { subscription } });
check('member subscribes a device', r.status === 201 && r.body.devices === 1, r.body);
r = await call('POST', '/member/notifications/push/subscribe', { token: A.token, body: { subscription } });
check('subscribing the same device again does not duplicate it', r.status === 201 && r.body.devices === 1, r.body);

// ── Staff messages ───────────────────────────────────────────────────────────
r = await call('GET', `/admin/notifications/members/${A.id}`, { token: desk.token });
check('desk sees which channels reach the member', r.status === 200 && r.body.email.available === true && r.body.push.configured === false && r.body.push.devices === 1 && Array.isArray(r.body.recent), r.body);
const msg = { memberId: A.id, title: uniq('Locker '), body: 'Please collect your locker key from the desk.', email: true, push: true, template: 'custom' };
check('message needs an Idempotency-Key (400)', (await call('POST', '/admin/notifications/messages', { token: desk.token, body: msg })).status === 400);
r = await call('POST', '/admin/notifications/messages', { token: desk.token, idem: key(), body: { ...msg, title: '' } });
check('message without a subject is rejected (422, field error)', r.status === 422 && Boolean(r.body.details?.fields?.title), r.body);
const msgKey = key();
r = await call('POST', '/admin/notifications/messages', { token: desk.token, idem: msgKey, body: msg });
check(
  'desk sends A a message (in app + email queued; push not set up)',
  r.status === 201 && r.body.notification.kind === 'message' && r.body.notification.channels.email.status === 'queued' && r.body.notification.channels.push.reason === 'push_not_configured',
  r.body
);
const again = await call('POST', '/admin/notifications/messages', { token: desk.token, idem: msgKey, body: msg });
check('retrying the message replays it', again.status === 201 && again.headers.get('idempotent-replayed') === 'true');
check('A received the message exactly once', (await inbox(A)).items.filter((n) => n.title === msg.title).length === 1);
r = await call('POST', '/admin/notifications/messages', { token: desk.token, idem: key(), body: { ...msg, memberId: E.id, push: false } });
check('message to a member without email: in app only, push not requested', r.status === 201 && r.body.notification.channels.email.reason === 'no_email' && r.body.notification.channels.push.reason === 'not_requested', r.body);
check('message to a missing member (404)', (await call('POST', '/admin/notifications/messages', { token: desk.token, idem: key(), body: { ...msg, memberId: '64b7f0c2a1b2c3d4e5f60718' } })).status === 404);
r = await call('GET', `/admin/notifications?group=messages&memberId=${A.id}`, { token: M });
check('log lists the message with who sent it', r.status === 200 && r.body.items.some((n) => n.title === msg.title && n.sentBy && n.member?._id === A.id), r.body);
check('log date range must be in order (422)', (await call('GET', `/admin/notifications?from=${today}&to=${addDays(today, -3)}`, { token: M })).status === 422);
check('log can show only problems', (await call('GET', '/admin/notifications?problems=true', { token: M })).status === 200);

r = await call('POST', '/member/notifications/push/unsubscribe', { token: A.token, body: { endpoint: subscription.endpoint } });
check('member unsubscribes the device', r.status === 200 && r.body.removed === true && r.body.devices === 0, r.body);

// ── Announcements ────────────────────────────────────────────────────────────
r = await call('POST', '/admin/announcements', { token: M, body: { title: '', body: '' } });
check('announcement needs a title and text (422, field errors)', r.status === 422 && Boolean(r.body.details?.fields?.title), r.body);
check('announcement image must be https (422)', (await call('POST', '/admin/announcements', { token: M, body: { title: 'x', body: 'y', imageUrl: 'http://example.com/a.png' } })).status === 422);
check('announcement category must be known (422)', (await call('POST', '/admin/announcements', { token: M, body: { title: 'x', body: 'y', category: 'party' } })).status === 422);

// A lapsed member (plan cancelled) must not get a "current members" announcement.
const X = await member({ planId: plan._id });
r = await call('POST', `/admin/members/${X.id}/memberships/${X.sale.membership._id}/cancel`, { token: T, body: { reason: 'e2e lapsed member' } });
check('X’s plan is cancelled (lapsed member)', r.status === 200, r.body);

r = await call('GET', '/admin/announcements/audience?audience=active', { token: M });
check('audience preview counts current members', r.status === 200 && r.body.count >= 5 && r.body.reachable <= r.body.count, r.body);

const title = uniq('Diwali hours ');
r = await call('POST', '/admin/announcements', { token: M, body: { title, body: 'Open 6–10 am on Diwali.\nClosed in the evening.', category: 'holiday', audience: 'active', pinned: true, sendEmail: true } });
check('manager creates a draft announcement', r.status === 201 && r.body.announcement.status === 'draft' && r.body.announcement.state === 'draft', r.body);
const ann = r.body.announcement;
check('drafts are not shown to members', !(await call('GET', '/member/announcements', { token: A.token })).body.items.some((a) => a._id === ann._id));
check('publish needs an Idempotency-Key (400)', (await call('POST', `/admin/announcements/${ann._id}/publish`, { token: M })).status === 400);
const pubKey = key();
r = await call('POST', `/admin/announcements/${ann._id}/publish`, { token: M, idem: pubKey });
check('publish makes it live at once', r.status === 200 && r.body.announcement.status === 'published' && r.body.announcement.state === 'live', r.body);
r = await call('POST', `/admin/announcements/${ann._id}/publish`, { token: M, idem: pubKey });
check('retrying publish replays it', r.status === 200 && r.headers.get('idempotent-replayed') === 'true');

const delivered = await waitFor(async () => {
  const x = await call('GET', `/admin/announcements/${ann._id}`, { token: M });
  return x.body.announcement?.delivery?.state === 'done' ? x.body.announcement : null;
}, 20000);
check('delivery finishes in the background', Boolean(delivered) && delivered.delivery.notified >= 1, delivered);
check('A (current member) got the announcement in the inbox', (await inbox(A)).items.filter((n) => n.kind === 'announcement' && n.title === title).length === 1);
check('X (lapsed) did not get it', !(await inbox(X)).items.some((n) => n.title === title));
const feed = (await call('GET', '/member/announcements', { token: A.token })).body;
check('member feed shows it, pinned first', feed.success && feed.items[0]?.pinned === true && feed.items.some((a) => a._id === ann._id), feed);
check('lapsed member’s feed does not show a current-members announcement', !(await call('GET', '/member/announcements', { token: X.token })).body.items.some((a) => a._id === ann._id));
check('member can open it', (await call('GET', `/member/announcements/${ann._id}`, { token: A.token })).body.announcement?.title === title);
check('lapsed member cannot open it (404)', (await call('GET', `/member/announcements/${ann._id}`, { token: X.token })).status === 404);

r = await call('POST', `/admin/announcements/${ann._id}/publish`, { token: M, idem: key() });
check('publishing again does not re-send', r.status === 200 && (await inbox(A)).items.filter((n) => n.title === title).length === 1, r.body);
r = await call('PATCH', `/admin/announcements/${ann._id}`, { token: M, body: { audience: 'all' } });
check('audience can’t change after sending (409)', r.status === 409 && r.body.code === 'ALREADY_SENT', r.body);
r = await call('PATCH', `/admin/announcements/${ann._id}`, { token: M, body: { body: 'Open 6–11 am on Diwali.' } });
check('text can still be corrected', r.status === 200 && r.body.announcement.body.includes('11 am'), r.body);
r = await call('GET', '/admin/announcements?status=live', { token: M });
const listed = r.body.items?.find((a) => a._id === ann._id);
check('list shows delivery stats and counts', r.status === 200 && listed?.stats.notified >= 1 && listed.stats.emailSent + listed.stats.emailFailed >= 1 && r.body.counts.live >= 1, listed || r.body);

r = await call('POST', `/admin/announcements/${ann._id}/unpublish`, { token: M });
check('unpublish takes it down', r.status === 200 && r.body.announcement.state === 'unpublished', r.body);
check('members no longer see it', !(await call('GET', '/member/announcements', { token: A.token })).body.items.some((a) => a._id === ann._id));
check('a sent announcement cannot be deleted (409)', (await call('DELETE', `/admin/announcements/${ann._id}`, { token: M })).status === 409);

// Scheduled: goes out when the job runs after its time; members who opted out get nothing.
r = await call('PATCH', '/member/notifications/preferences', { token: D.token, body: { announcements: false } });
check('D turns off announcements', r.status === 200 && r.body.preferences.announcements === false);
const later = new Date(Date.now() + 2 * 3600_000).toISOString();
const t2 = uniq('Zumba Saturday ');
r = await call('POST', '/admin/announcements', { token: M, body: { title: t2, body: 'Free zumba class at 7 am.', category: 'event', audience: 'all', publishAt: later } });
const ann2 = r.body.announcement;
r = await call('POST', `/admin/announcements/${ann2._id}/publish`, { token: M, idem: key() });
check('publishing with a future time schedules it', r.status === 200 && r.body.announcement.status === 'scheduled', r.body);
check('scheduled announcements are not shown yet', !(await call('GET', '/member/announcements', { token: A.token })).body.items.some((a) => a._id === ann2._id));
r = await call('POST', '/admin/reminders/test/run', { token: M, body: { now: new Date(Date.now() + 2 * 3600_000 + 60_000).toISOString(), jobs: ['announcements'] } });
check('the announcement job publishes it when due', r.status === 200 && r.body.announcements.published >= 1, r.body);
const got2 = await waitFor(async () => (await inbox(A)).items.some((n) => n.title === t2), 20000);
check('A got the scheduled announcement', got2);
await waitFor(async () => (await call('GET', `/admin/announcements/${ann2._id}`, { token: M })).body.announcement?.delivery?.state === 'done', 20000);
check('D (opted out) did not', !(await inbox(D)).items.some((n) => n.title === t2));

const draft = (await call('POST', '/admin/announcements', { token: M, body: { title: uniq('Draft '), body: 'x' } })).body.announcement;
check('a draft can be deleted', (await call('DELETE', `/admin/announcements/${draft._id}`, { token: M })).status === 200);
check('deleted draft is gone (404)', (await call('GET', `/admin/announcements/${draft._id}`, { token: M })).status === 404);
check('announcement with an end date in the past is rejected (422)', (await call('POST', '/admin/announcements', { token: M, body: { title: 'x', body: 'y', expiresAt: new Date(Date.now() - 3600_000).toISOString() } })).status === 422);

finish();
