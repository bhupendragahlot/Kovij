// Settings → Member sign-in: the owner turns mobile-code and Google sign-in on or off. Password
// sign-in (mobile number, email or member ID) is always on. Restores both switches at the end.
import { adminToken, call, check, finish, key, staffToken, testDob, uniq, uniqPhone } from '../lib.mjs';

const T = await adminToken();
const manager = await staffToken('manager', T);
const config = async () => (await call('GET', '/member/auth/config')).body;
const setMethods = (memberSignIn, token = T) => call('PATCH', '/admin/settings', { token, body: { memberSignIn } });

let c = await config();
check('both optional methods are on by default', c.methods?.password === true && c.methods.mobileOtp === true && c.methods.google === true && c.phoneSignIn === 'test' && Boolean(c.googleClientId), c);

check('a manager cannot change sign-in methods (403)', (await setMethods({ mobileOtp: false }, manager.token)).status === 403);
check('only true/false is accepted (422)', (await setMethods({ mobileOtp: 'no' })).status === 422);

// ── Mobile code off ────────────────────────────────────────────────────────
let r = await setMethods({ mobileOtp: false });
check('owner turns mobile-code sign-in off; Google is untouched', r.status === 200 && r.body.settings.memberSignIn.mobileOtp === false && r.body.settings.memberSignIn.google === true, r.body.settings?.memberSignIn);
c = await config();
check('the sign-in page is told to hide mobile sign-in', c.methods.mobileOtp === false && c.phoneSignIn === 'off' && c.codeLength === undefined, c);
const otpPhone = uniqPhone();
r = await call('POST', '/member/auth/otp/request', { body: { phone: otpPhone } });
check('asking for a code is refused (403)', r.status === 403 && r.body.code === 'SIGNIN_METHOD_OFF' && /password/.test(r.body.message), r.body);
r = await call('POST', '/member/auth/otp/verify', { body: { phone: otpPhone, code: '112233', name: uniq('Blocked ') } });
check('signing in with the code is refused too (403)', r.status === 403 && r.body.code === 'SIGNIN_METHOD_OFF', r.body);

const phone = uniqPhone();
const dob = testDob();
await call('POST', '/admin/members', { token: T, body: { details: { name: uniq('Pw '), phone, dob }, force: true }, idem: key() });
const [y, m, d] = dob.split('-');
r = await call('POST', '/member/auth/password', { body: { login: phone, password: `${d}${m}${y}` } });
check('password sign-in still works', r.status === 200 && Boolean(r.body.token), r.body);

// ── Google off ─────────────────────────────────────────────────────────────
r = await setMethods({ google: false });
check('owner turns Google off; mobile stays off', r.status === 200 && r.body.settings.memberSignIn.google === false && r.body.settings.memberSignIn.mobileOtp === false, r.body.settings?.memberSignIn);
c = await config();
check('the page gets no Google client id', c.methods.google === false && c.googleClientId === null, c);
r = await call('POST', '/member/auth/google-id', { body: { credential: 'header.payload.signature' } });
check('Google sign-in is refused before the token is even checked (403)', r.status === 403 && r.body.code === 'SIGNIN_METHOD_OFF', r.body);

// ── Back on ────────────────────────────────────────────────────────────────
r = await setMethods({ mobileOtp: true, google: true });
c = await config();
check('both back on', r.status === 200 && c.methods.mobileOtp === true && c.methods.google === true && c.phoneSignIn === 'test' && Boolean(c.googleClientId), c);
r = await call('POST', '/member/auth/otp/verify', { body: { phone: uniqPhone(), code: '112233', name: uniq('Back On ') } });
check('mobile-code sign-in works again', [200, 201].includes(r.status) && Boolean(r.body.token), r.body);

finish();
