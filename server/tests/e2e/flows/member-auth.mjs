// Member sign-in exchange. Real Firebase tokens can't be minted here, so this covers the wiring
// and refusals; the linking rules themselves are unit-tested in tests/memberIdentity.test.js.
import { call, check, finish } from '../lib.mjs';

const bad = await call('POST', '/member/auth/session', { body: { idToken: 'not-a-real-firebase-token-xxxxxxxx' } });
check('a forged sign-in token is refused (401)', bad.status === 401 && bad.body.code === 'FIREBASE_AUTH_FAILED', bad.body);

const legacy = await call('POST', '/member/auth/google', { body: { idToken: 'not-a-real-firebase-token-xxxxxxxx' } });
check('the older /google path uses the same check', legacy.status === 401, legacy.status);

const missing = await call('POST', '/member/auth/session', { body: {} });
check('missing token is a validation error', missing.status === 400 || missing.status === 422, missing.status);

const badChoice = await call('POST', '/member/auth/session', { body: { idToken: 'x'.repeat(20), memberId: 'someone' } });
check('a member choice must be an id or "new"', badChoice.status === 400 || badChoice.status === 422, badChoice.status);

finish();
