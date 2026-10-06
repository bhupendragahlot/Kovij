// Member app passwords: date of birth required at registration and used as the first password;
// sign in with mobile number, email or member ID; change password; staff reset; lockout.
import { adminToken, call, check, finish, key, staffToken, uniq, uniqPhone } from '../lib.mjs';

const T = await adminToken();
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);

const register = (details, token = T) => call('POST', '/admin/members', { token, body: { details, force: true }, idem: key() });
const signIn = (login, password, extra = {}) => call('POST', '/member/auth/password', { body: { login, password, ...extra } });
const change = (token, body) => call('POST', '/member/auth/password/change', { token, body });

// ── Date of birth is required at registration ──────────────────────────────
const noDob = await register({ name: uniq('No Dob '), phone: uniqPhone() });
check('registration without a date of birth is refused (422)', noDob.status === 422 && /date of birth/i.test(noDob.body.details?.fields?.['details.dob'] || ''), noDob.body);
const futureDob = await register({ name: uniq('Future '), phone: uniqPhone(), dob: '2099-01-01' });
check('a date of birth in the future is refused (422)', futureDob.status === 422 && futureDob.body.details.fields['details.dob'], futureDob.body);

const phone = uniqPhone();
const email = `${uniq('pw')}@example.com`;
const reg = await register({ name: uniq('Asha '), phone, email, dob: '1995-08-15' }, desk.token);
const A = reg.body?.member;
check('front desk registers a member with a date of birth (201)', reg.status === 201 && A?._id, reg.body);
check('no password hash in any answer', !JSON.stringify(reg.body).includes('passwordHash'));
const profile = await call('GET', `/admin/members/${A._id}`, { token: desk.token });
check('profile shows the app password is the date of birth', profile.status === 200 && profile.body.appPassword?.set === true && profile.body.appPassword.isDefault === true, profile.body.appPassword);
check('profile never carries the hash', !JSON.stringify(profile.body).includes('passwordHash'));
const list = await call('GET', `/admin/members?q=${encodeURIComponent(A.name)}`, { token: desk.token });
check('member list never carries the hash', list.status === 200 && !JSON.stringify(list.body).includes('passwordHash'));

// ── Signing in with the date of birth ──────────────────────────────────────
const byPhone = await signIn(phone, '15081995');
check('member signs in with mobile number + date of birth (DDMMYYYY)', byPhone.status === 200 && byPhone.body.member.id === A._id && Boolean(byPhone.body.token), byPhone.body);
check('…typed as a date too (15-08-1995)', (await signIn(phone, '15-08-1995')).status === 200);
check('…with the email', (await signIn(email.toUpperCase(), '15081995')).status === 200);
check('…with the member ID', (await signIn(A.memberCode.toLowerCase(), '15081995')).status === 200, A.memberCode);
const wrong = await signIn(phone, '16081995');
check('wrong password: plain 401', wrong.status === 401 && wrong.body.code === 'WRONG_PASSWORD', wrong.body);
const unknown = await signIn(uniqPhone(), '15081995');
check('unknown login gets the same answer (no account probing)', unknown.status === 401 && unknown.body.code === 'WRONG_PASSWORD', unknown.body);
check('login that is not a phone, email or ID (422)', (await signIn('12', 'x')).status === 422);

let token = byPhone.body.token;
const me = await call('GET', '/member/auth/me', { token });
check('member app knows the password is still the date of birth', me.status === 200 && me.body.appPassword?.isDefault === true, me.body.appPassword);

// ── Changing the password ──────────────────────────────────────────────────
let r = await change(token, { newPassword: 'blue-river-2026', confirmPassword: 'blue-river-2026' });
check('current password is required (422)', r.status === 422 && r.body.details.fields.currentPassword, r.body);
r = await change(token, { currentPassword: '01011990', newPassword: 'blue-river-2026', confirmPassword: 'blue-river-2026' });
check('wrong current password (422)', r.status === 422 && /isn’t your current password/.test(r.body.details.fields.currentPassword), r.body);
r = await change(token, { currentPassword: '15081995', newPassword: 'blue-river-2026', confirmPassword: 'blue-river-2027' });
check('new and confirm must match (422)', r.status === 422 && r.body.details.fields.confirmPassword, r.body);
r = await change(token, { currentPassword: '15081995', newPassword: '15-08-1995', confirmPassword: '15-08-1995' });
check('the date of birth can’t be the new password (422)', r.status === 422 && /date of birth/.test(r.body.details.fields.newPassword), r.body);
r = await change(token, { currentPassword: '15081995', newPassword: 'short', confirmPassword: 'short' });
check('too short (422)', r.status === 422 && /at least 8/.test(r.body.details.fields.newPassword), r.body);
const otherDevice = (await signIn(phone, '15081995')).body.token;
await new Promise((res) => setTimeout(res, 1100)); // a session issued in an earlier second than the change
r = await change(token, { currentPassword: '15-08-1995', newPassword: 'blue-river-2026', confirmPassword: 'blue-river-2026' });
check('member changes their password', r.status === 200 && Boolean(r.body.token) && r.body.appPassword.isDefault === false, r.body);
const fresh = r.body.token;
check('this device stays signed in with the new token', (await call('GET', '/member/auth/me', { token: fresh })).status === 200);
const revoked = await call('GET', '/member/auth/me', { token: otherDevice });
check('other devices are signed out (401)', revoked.status === 401 && revoked.body.code === 'SESSION_REVOKED', revoked.body);
check('the date of birth no longer works', (await signIn(phone, '15081995')).status === 401);
check('the new password works', (await signIn(phone, 'blue-river-2026')).status === 200);
token = fresh;

// Staff fixing the date of birth doesn't touch a password the member chose.
await call('PATCH', `/admin/members/${A._id}`, { token: desk.token, body: { details: { dob: '1995-08-16' } } });
check('a chosen password survives a date-of-birth edit', (await signIn(phone, 'blue-river-2026')).status === 200);

// ── Staff reset (member forgot it) ─────────────────────────────────────────
check('trainer cannot reset app passwords (403)', (await call('POST', `/admin/members/${A._id}/app-password/reset`, { token: trainer.token })).status === 403);
await new Promise((res) => setTimeout(res, 1100)); // sessions within the same second as a reset are kept
const reset = await call('POST', `/admin/members/${A._id}/app-password/reset`, { token: desk.token });
check('desk resets the app password to the date of birth', reset.status === 200 && reset.body.message.includes('16081995') && reset.body.appPassword.isDefault === true, reset.body);
check('the reset signs the member out', (await call('GET', '/member/auth/me', { token })).status === 401);
check('the (corrected) date of birth signs in again', (await signIn(phone, '16081995')).status === 200);
// While it's still the default, a corrected date of birth becomes the password.
await call('PATCH', `/admin/members/${A._id}`, { token: desk.token, body: { details: { dob: '1995-08-17' } } });
check('a still-default password follows a corrected date of birth', (await signIn(phone, '17081995')).status === 200 && (await signIn(phone, '16081995')).status === 401);
let entry;
for (let i = 0; i < 10 && !entry; i += 1) {
  entry = (await call('GET', `/admin/activity?memberId=${A._id}`, { token: T })).body?.items?.find((e) => e.action === 'member.app_password_reset');
  if (!entry) await new Promise((res) => setTimeout(res, 150));
}
check('the reset is in the activity log', Boolean(entry) && entry.summary.includes('app password'), entry);

// ── Members who joined in the app (no password yet) ────────────────────────
const appPhone = uniqPhone();
const otp = await call('POST', '/member/auth/otp/verify', { body: { phone: appPhone, code: '112233', name: uniq('App Joiner ') } });
check('a member joins in the app with a mobile code', [200, 201].includes(otp.status) && Boolean(otp.body.token), otp.body);
const noPw = await signIn(appPhone, '01011990');
check('password sign-in explains there is no password yet (409)', noPw.status === 409 && noPw.body.code === 'NO_PASSWORD', noPw.body);
const set = await change(otp.body.token, { newPassword: 'green-hill-88', confirmPassword: 'green-hill-88' });
check('they can set one without a current password', set.status === 200 && set.body.appPassword.set === true, set.body);
check('…and sign in with it', (await signIn(appPhone, 'green-hill-88')).status === 200);

// ── Family sharing one phone ───────────────────────────────────────────────
const family = uniqPhone();
const p1 = (await register({ name: uniq('Ravi '), phone: family, dob: '1980-03-10' })).body.member;
const p2 = (await register({ name: uniq('Ravi Jr '), phone: family, dob: '2008-03-10' })).body.member;
check('shared phone: each date of birth signs in its own member', (await signIn(family, '10031980')).body.member?.id === p1._id && (await signIn(family, '10032008')).body.member?.id === p2._id);
const twin = (await register({ name: uniq('Twin '), phone: family, dob: '2008-03-10' })).body.member;
const both = await signIn(family, '10032008');
check('same phone and password: asked to choose (409)', both.status === 409 && both.body.code === 'CHOOSE_MEMBER' && both.body.details.candidates.length === 2, both.body);
check('…and the chosen member signs in', (await signIn(family, '10032008', { memberId: twin._id })).body.member?.id === twin._id);

// ── Lockout ────────────────────────────────────────────────────────────────
const lockPhone = uniqPhone();
await register({ name: uniq('Lock '), phone: lockPhone, dob: '1999-12-31' });
for (let i = 0; i < 5; i += 1) await signIn(lockPhone, `wrong-${i}-pass`);
const locked = await signIn(lockPhone, '31121999');
check('5 wrong passwords lock that login, even for the right one (429)', locked.status === 429 && locked.body.code === 'LOGIN_LOCKED' && /15 minutes/.test(locked.body.message), locked.body);
check('other logins are not affected', (await signIn(phone, '17081995')).status === 200);

finish();
