// Member sign-in exchange. Real Firebase tokens can't be minted here, so this covers the wiring
// and refusals; the linking rules themselves are unit-tested in tests/memberIdentity.test.js.
import { createRequire } from 'node:module';
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

// ── Sign in with Google (Google Identity Services ID tokens) ─────────────────
const requireJwt = createRequire(import.meta.url)('jsonwebtoken');
const googleToken = (claims, { audience = process.env.E2E_GOOGLE_CLIENT_ID, expiresIn = '1h' } = {}) =>
  requireJwt.sign({ email_verified: true, ...claims }, process.env.E2E_GOOGLE_KEY, { algorithm: 'RS256', keyid: 'e2e-key', audience, issuer: 'https://accounts.google.com', expiresIn });

check('the app is told the Google client id', config.body.googleClientId === process.env.E2E_GOOGLE_CLIENT_ID, config.body);
const gEmail = `${uniq('g')}@gmail.com`;
const gNew = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub: uniq('sub'), email: gEmail, name: 'Gita Google', picture: 'https://lh3.googleusercontent.com/a/x' }) } });
check('a new Google user gets an account with their name and photo', gNew.status === 201 && gNew.body.member.name === 'Gita Google' && gNew.body.member.email === gEmail && gNew.body.member.profilePhoto.startsWith('https://'), gNew.body);
const gAgain = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub: 'other-sub-not-used', email: gEmail }) } });
check('a different Google account with the same email is refused', gAgain.status === 409 && gAgain.body.code === 'EMAIL_IN_USE', gAgain.body);

const { member: deskByEmail } = await createMember(T, { name: uniq('Email Desk ') });
const sub = uniq('sub');
const gLink = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub, email: deskByEmail.email, name: 'Ignored Name' }) } });
check('a desk member signing in with Google (same email) lands in their account', gLink.status === 200 && String(gLink.body.member.id) === String(deskByEmail._id) && gLink.body.member.name === deskByEmail.name, gLink.body);
const gSame = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub, email: deskByEmail.email }) } });
check('the next Google sign-in goes straight to the same member', gSame.status === 200 && String(gSame.body.member.id) === String(deskByEmail._id));
check('…and the session works', (await call('GET', '/member/auth/me', { token: gSame.body.token })).status === 200);

const wrongApp = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub: uniq('s'), email: `${uniq('x')}@gmail.com` }, { audience: 'another-app.apps.googleusercontent.com' }) } });
check('a Google token made for another app is refused (401)', wrongApp.status === 401 && wrongApp.body.code === 'GOOGLE_TOKEN_INVALID');
const expired = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub: uniq('s'), email: `${uniq('x')}@gmail.com` }, { expiresIn: -120 }) } });
check('an expired Google token is refused', expired.status === 401);
const unverified = await call('POST', '/member/auth/google-id', { body: { credential: googleToken({ sub: uniq('s'), email: `${uniq('x')}@gmail.com`, email_verified: false }) } });
check('a Google account with an unverified email is refused', unverified.status === 403 && unverified.body.code === 'GOOGLE_EMAIL_NOT_VERIFIED');
check('a made-up credential is refused', (await call('POST', '/member/auth/google-id', { body: { credential: 'x'.repeat(40) } })).status === 401);

finish();
