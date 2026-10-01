// Staff security: activity log, sign-in history and lockout, password reset and change,
// staff reset links, gym logo, opening hours and holidays.
import { ORIGIN, adminToken, call, check, createMember, createPlan, finish, staffToken, uniq } from '../lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Activity is written just after each response; poll briefly instead of guessing a delay. */
async function findActivity(token, query, match) {
  for (let i = 0; i < 20; i += 1) {
    const r = await call('GET', `/admin/activity?limit=50${query}`, { token });
    const hit = r.body?.items?.find(match);
    if (hit) return hit;
    await sleep(150);
  }
  return null;
}

const T = await adminToken();
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);

// ── Activity log ────────────────────────────────────────────────────────────
const plan = await createPlan(T);
const { member } = await createMember(T, { planId: plan._id, name: uniq('Rahul ') });
const created = await findActivity(T, '', (e) => e.action === 'member.create' && e.member?.id === String(member._id));
check('registering a member is logged with the member’s name', Boolean(created) && created.summary.includes(member.name) && created.actor.name === 'Raj Owner', created);
check('activity entries carry no request data', created && !('body' in created) && !('password' in created));
const planEntry = await findActivity(T, '', (e) => e.action === 'plan.create');
check('adding a plan is logged', Boolean(planEntry) && planEntry.summary === 'Raj Owner added a plan', planEntry);

const refused = await call('PATCH', '/admin/settings', { token: desk.token, body: { gymName: 'Hacked' } });
check('front desk cannot change settings (403)', refused.status === 403);
const failedEntry = await findActivity(T, '&outcome=failed', (e) => e.action === 'settings.update' && e.actor.id === desk.user.id);
check('a refused change is logged as failed', Boolean(failedEntry) && failedEntry.ok === false && failedEntry.status === 403, failedEntry);
const byMember = await call('GET', `/admin/activity?memberId=${member._id}`, { token: T });
check('activity can be filtered by member', byMember.status === 200 && byMember.body.items.length >= 1 && byMember.body.items.every((e) => e.member?.id === String(member._id)));
check('first page lists staff for the filter', Array.isArray(byMember.body.staff) && byMember.body.staff.some((s) => s.name === 'Raj Owner'));
check('front desk cannot read the activity log (403)', (await call('GET', '/admin/activity', { token: desk.token })).status === 403);
check('trainer cannot read the activity log (403)', (await call('GET', '/admin/activity', { token: trainer.token })).status === 403);
check('bad date range is a field error', (await call('GET', '/admin/activity?from=2026-09-30&to=2026-09-01', { token: T })).status === 422);

// ── Sign-ins and lockout ────────────────────────────────────────────────────
const email = `${uniq('lock')}@kovij.test`;
const made = await call('POST', '/admin/staff', { token: T, body: { name: 'Lock Test', username: uniq('lock'), email, role: 'staff', password: 'first-pass-123' } });
check('owner adds a staff account', made.status === 201, made.body);
const weak = await call('POST', '/admin/staff', { token: T, body: { name: 'Weak', username: uniq('weak'), email: `${uniq('weak')}@kovij.test`, role: 'staff', password: 'password' } });
check('an easy-to-guess password is refused', weak.status === 422 && Boolean(weak.body.details?.fields?.password), weak.body);
const staffId = made.body.staff.id;
const firstLogin = await call('POST', '/auth/login', { body: { email, password: 'first-pass-123' } });
check('new staff can sign in', firstLogin.status === 200);
const oldSession = firstLogin.body.token;
await sleep(1100); // sessions are compared to the second

const attempts = [];
for (let i = 0; i < 5; i += 1) attempts.push(await call('POST', '/auth/login', { body: { email, password: `wrong-${i}-pass` } }));
check('wrong passwords are refused (401)', attempts.slice(0, 4).every((r) => r.status === 401 && r.body.code === 'INVALID_CREDENTIALS'));
check('the last tries warn before the pause', /more tr/.test(attempts[3].body.message) && attempts[3].body.details?.attemptsLeft === 1, attempts[3].body);
check('the 5th wrong password pauses sign-in (429)', attempts[4].status === 429 && attempts[4].body.code === 'ACCOUNT_LOCKED' && attempts[4].body.details.retryAfterMinutes >= 14, attempts[4].body);
const whileLocked = await call('POST', '/auth/login', { body: { email, password: 'first-pass-123' } });
check('even the right password waits while paused', whileLocked.status === 429);
const unknown = await call('POST', '/auth/login', { body: { email: `${uniq('ghost')}@kovij.test`, password: 'whatever-123' } });
check('an unknown email gets the same answer as a wrong password', unknown.status === 401 && unknown.body.message === 'Email or password is incorrect');

const staffList = await call('GET', '/admin/staff', { token: T });
check('the staff list shows the pause', staffList.body.staff.find((s) => s.id === staffId)?.lockedForMinutes >= 14);
const signIns = await call('GET', `/admin/activity/sign-ins?userId=${staffId}`, { token: T });
check('sign-in history records each attempt with a reason', signIns.status === 200 && signIns.body.items.filter((e) => e.reason === 'wrong_password').length === 5 && signIns.body.items.some((e) => e.reason === 'locked'), signIns.body.items?.map((e) => e.reason));
check('sign-in history shows a device label', typeof signIns.body.items[0].device === 'string');
const failedOnly = await call('GET', '/admin/activity/sign-ins?outcome=failed', { token: T });
check('failed sign-ins can be listed alone, with a 24-hour count', failedOnly.body.items.every((e) => !e.success) && failedOnly.body.failedLast24h >= 6);

// ── Forgot password → reset ─────────────────────────────────────────────────
const forgot = await call('POST', '/auth/forgot-password', { body: { email } });
const forgotUnknown = await call('POST', '/auth/forgot-password', { body: { email: `${uniq('nobody')}@kovij.test` } });
check('forgot password answers the same for known and unknown emails', forgot.status === 200 && forgotUnknown.status === 200 && forgot.body.message === forgotUnknown.body.message);
let token = null;
for (let i = 0; i < 20 && !token; i += 1) {
  token = (await call('GET', `/auth/_test/reset-token?userId=${staffId}`)).body?.token;
  if (!token) await sleep(100);
}
check('a reset link is issued', typeof token === 'string' && token.length > 30);
const linkCheck = await call('GET', `/auth/reset-password?token=${encodeURIComponent(token)}`);
check('the reset page can check the link first', linkCheck.body.valid === true && linkCheck.body.email === email);
check('a made-up link is reported as not valid', (await call('GET', `/auth/reset-password?token=${'x'.repeat(40)}`)).body.valid === false);
const weakReset = await call('POST', '/auth/reset-password', { body: { token, password: email } });
check('the new password can’t be the email', weakReset.status === 422 && Boolean(weakReset.body.details?.fields?.password));
const reset = await call('POST', '/auth/reset-password', { body: { token, password: 'second-pass-456' } });
check('reset sets the new password', reset.status === 200, reset.body);
const reuse = await call('POST', '/auth/reset-password', { body: { token, password: 'third-pass-789' } });
check('a reset link works only once (410)', reuse.status === 410 && reuse.body.code === 'RESET_LINK_INVALID');
check('old sessions are signed out by the reset', (await call('GET', '/auth/me', { token: oldSession })).body?.code === 'SESSION_REVOKED');
const afterReset = await call('POST', '/auth/login', { body: { email, password: 'second-pass-456' } });
check('the reset also lifts the sign-in pause', afterReset.status === 200, afterReset.body);
let session = afterReset.body.token;

// ── Change own password ─────────────────────────────────────────────────────
await sleep(1100);
const wrongCurrent = await call('POST', '/auth/change-password', { token: session, body: { currentPassword: 'nope-nope-1', newPassword: 'fourth-pass-000' } });
check('changing password needs the current one', wrongCurrent.status === 422 && Boolean(wrongCurrent.body.details?.fields?.currentPassword));
const same = await call('POST', '/auth/change-password', { token: session, body: { currentPassword: 'second-pass-456', newPassword: 'second-pass-456' } });
check('the new password must differ', same.status === 422 && Boolean(same.body.details?.fields?.newPassword));
const changed = await call('POST', '/auth/change-password', { token: session, body: { currentPassword: 'second-pass-456', newPassword: 'fourth-pass-000' } });
check('password change returns a fresh session', changed.status === 200 && typeof changed.body.token === 'string', changed.body);
check('the fresh session works', (await call('GET', '/auth/me', { token: changed.body.token })).status === 200);
check('the previous session is signed out', (await call('GET', '/auth/me', { token: session })).status === 401);
session = changed.body.token;
const mine = await call('GET', '/auth/sign-ins', { token: session });
check('my recent sign-ins include the reset and sign-ins', mine.status === 200 && mine.body.items.some((e) => e.reason === 'password_reset') && mine.body.items.some((e) => e.reason === 'ok'));
const changeLogged = await findActivity(T, `&actorId=${staffId}`, (e) => e.action === 'auth.change_password');
check('the password change is in the activity log', Boolean(changeLogged) && changeLogged.summary === 'Lock Test changed their password', changeLogged);

// ── Owner sends a reset link ────────────────────────────────────────────────
const sent = await call('POST', `/admin/staff/${staffId}/reset-link`, { token: T });
check('owner can email a reset link (202)', sent.status === 202 && sent.body.message.includes(email), sent.body);
check('front desk cannot send reset links (403)', (await call('POST', `/admin/staff/${staffId}/reset-link`, { token: desk.token })).status === 403);
const ownerSet = await call('PATCH', `/admin/staff/${staffId}`, { token: T, body: { password: '12345678' } });
check('owner-set passwords follow the same rules', ownerSet.status === 422);

// ── Gym logo, hours and holidays ────────────────────────────────────────────
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const form = (bytes, type = 'image/png') => {
  const fd = new FormData();
  fd.append('photo', new Blob([bytes], { type }), 'logo.png');
  return fd;
};
const logo = await call('POST', '/admin/settings/logo', { token: T, body: form(PNG) });
const logoUrl = logo.body?.settings?.logoUrl;
check('owner uploads a gym logo', logo.status === 200 && /^\/uploads\/avatars\//.test(logoUrl || ''), logo.body);
check('the logo is public in website settings', (await call('GET', '/settings')).body.logoUrl === logoUrl);
check('the logo file is served', (await fetch(ORIGIN + logoUrl)).status === 200);
check('a fake image is refused as a logo', (await call('POST', '/admin/settings/logo', { token: T, body: form(Buffer.from('not an image, honest'), 'image/png') })).status === 422);
check('front desk cannot change the logo (403)', (await call('POST', '/admin/settings/logo', { token: desk.token, body: form(PNG) })).status === 403);
const removed = await call('DELETE', '/admin/settings/logo', { token: T });
check('owner removes the logo', removed.status === 200 && !removed.body.settings.logoUrl);
check('a removed upload is a 404, not the app page', (await fetch(ORIGIN + logoUrl)).status === 404);
check('a script link can’t be saved as the logo', (await call('PATCH', '/admin/settings', { token: T, body: { logoUrl: 'javascript:alert(1)' } })).status === 422);

const overlap = await call('PATCH', '/admin/settings', { token: T, body: { openingHours: [{ day: 1, closed: false, slots: [{ open: '06:00', close: '12:00' }, { open: '11:00', close: '21:00' }] }] } });
check('overlapping sessions are refused', overlap.status === 422, overlap.body);
const week = [0, 1, 2, 3, 4, 5, 6].map((day) => (day === 0 ? { day, closed: true, slots: [] } : { day, closed: false, slots: [{ open: '05:30', close: '10:30' }, { open: '16:30', close: '21:30' }] }));
const hours = await call('PATCH', '/admin/settings', { token: T, body: { openingHours: week, holidays: [{ date: '2026-11-08', name: 'Diwali' }] } });
check('owner saves weekly hours and a holiday', hours.status === 200 && hours.body.settings.openingHours[1].slots[0].open === '05:30' && hours.body.settings.holidays[0].name === 'Diwali', hours.body);
const pub = await call('GET', '/settings');
check('hours and holidays are public', pub.body.openingHours[1].slots.length === 2 && pub.body.holidays.length === 1);
check('a holiday date can only be listed once', (await call('PATCH', '/admin/settings', { token: T, body: { holidays: [{ date: '2026-11-08', name: 'A' }, { date: '2026-11-08', name: 'B' }] } })).status === 422);

finish();
