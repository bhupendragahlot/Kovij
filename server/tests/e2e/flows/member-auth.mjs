// Member sign-in exchange. Real Firebase tokens can't be minted here, so this covers the wiring
// and refusals; the linking rules themselves are unit-tested in tests/memberIdentity.test.js.
import { adminToken, call, check, createMember, finish, key, uniq, uniqPhone } from '../lib.mjs';

const bad = await call('POST', '/member/auth/session', { body: { idToken: 'not-a-real-firebase-token-xxxxxxxx' } });
check('a forged sign-in token is refused (401)', bad.status === 401 && bad.body.code === 'FIREBASE_AUTH_FAILED', bad.body);

const legacy = await call('POST', '/member/auth/google', { body: { idToken: 'not-a-real-firebase-token-xxxxxxxx' } });
check('the older /google path uses the same check', legacy.status === 401, legacy.status);

const missing = await call('POST', '/member/auth/session', { body: {} });
check('missing token is a validation error', missing.status === 400 || missing.status === 422, missing.status);

const badChoice = await call('POST', '/member/auth/session', { body: { idToken: 'x'.repeat(20), memberId: 'someone' } });
check('a member choice must be an id or "new"', badChoice.status === 400 || badChoice.status === 422, badChoice.status);

// ── Test-mode mobile sign-in (DEFAULT_OTP=112233 in the e2e server) ─────────
const config = await call('GET', '/member/auth/config');
check('the app is told mobile sign-in is in test mode', config.body.phoneSignIn === 'test', config.body);

const phone = uniqPhone();
const req1 = await call('POST', '/member/auth/otp/request', { body: { phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` } });
check('asking for a code sends nothing and says test mode', req1.status === 200 && req1.body.testMode === true && req1.body.phone === phone, req1.body);
check('a malformed number is refused', (await call('POST', '/member/auth/otp/request', { body: { phone: '12345' } })).status === 422);

const wrong = await call('POST', '/member/auth/otp/verify', { body: { phone, code: '999999' } });
check('a wrong code is refused (401)', wrong.status === 401 && wrong.body.code === 'OTP_WRONG');
const noName = await call('POST', '/member/auth/otp/verify', { body: { phone, code: '112233' } });
check('a new number is asked for a name first', noName.status === 422 && noName.body.code === 'NEEDS_NAME', noName.body);
const fresh = await call('POST', '/member/auth/otp/verify', { body: { phone, code: '112233', name: 'Test Otp Member' } });
check('the right code with a name creates the member and signs in', fresh.status === 201 && Boolean(fresh.body.token) && fresh.body.member.phone === phone, fresh.body);
const meNow = await call('GET', '/member/auth/me', { token: fresh.body.token });
check('the session works', meNow.status === 200 && meNow.body.member.name === 'Test Otp Member');
const again = await call('POST', '/member/auth/otp/verify', { body: { phone, code: '112233' } });
check('signing in again finds the same member', again.status === 200 && String(again.body.member.id) === String(fresh.body.member.id));

// A member the desk registered signs in with their number and gets their own record.
const T = await adminToken();
const { member: deskMember } = await createMember(T, { name: uniq('Desk Member ') });
const desk = await call('POST', '/member/auth/otp/verify', { body: { phone: deskMember.phone, code: '112233' } });
check('a desk-registered member lands in their existing account', desk.status === 200 && String(desk.body.member.id) === String(deskMember._id), desk.body);

// Two members on one family phone: the person chooses.
const shared = uniqPhone();
for (const n of ['Family One', 'Family Two']) {
  await call('POST', '/admin/members', { token: T, body: { details: { name: uniq(n), phone: shared }, force: true }, idem: key() });
}
const choose = await call('POST', '/member/auth/otp/verify', { body: { phone: shared, code: '112233' } });
check('a shared number asks who you are', choose.status === 409 && choose.body.code === 'CHOOSE_MEMBER' && choose.body.details.candidates.length === 2, choose.body);
const picked = await call('POST', '/member/auth/otp/verify', { body: { phone: shared, code: '112233', memberId: choose.body.details.candidates[1].id } });
check('…and signs in as the one chosen', picked.status === 200 && String(picked.body.member.id) === choose.body.details.candidates[1].id);

finish();
