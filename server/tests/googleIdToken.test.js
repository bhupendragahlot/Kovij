import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { GoogleTokenError, resetGoogleKeyCache, verifyGoogleIdToken } from '../services/googleIdToken.js';
import { decideGoogleLink, identityFromGoogle } from '../services/memberIdentity.js';

const CLIENT = '123-test.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'key-1', alg: 'RS256', use: 'sig' };

let fetches = 0;
const fetchImpl = async () => {
  fetches += 1;
  return { ok: true, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: [jwk] }) };
};
const sign = (claims = {}, { key = privateKey, kid = 'key-1', expiresIn = '1h' } = {}) =>
  jwt.sign({ sub: '1098', email: 'priya@gmail.com', email_verified: true, name: 'Priya S', ...claims }, key, {
    algorithm: 'RS256',
    keyid: kid,
    audience: CLIENT,
    issuer: 'https://accounts.google.com',
    expiresIn,
  });
const verify = (token, opts = {}) => verifyGoogleIdToken(token, { clientId: CLIENT, fetchImpl, ...opts });

beforeEach(() => {
  resetGoogleKeyCache();
  fetches = 0;
});

test('a genuine Google token for our client is accepted', async () => {
  const claims = await verify(sign());
  assert.equal(claims.sub, '1098');
  assert.equal(claims.email, 'priya@gmail.com');
  await verify(sign());
  assert.equal(fetches, 1, 'Google’s keys are cached');
});

test('tokens for another app, from another issuer, expired or forged are refused', async () => {
  const forOtherApp = jwt.sign({ sub: '1' }, privateKey, { algorithm: 'RS256', keyid: 'key-1', audience: 'someone-else', issuer: 'accounts.google.com', expiresIn: '1h' });
  await assert.rejects(verify(forOtherApp), GoogleTokenError);
  const otherIssuer = jwt.sign({ sub: '1' }, privateKey, { algorithm: 'RS256', keyid: 'key-1', audience: CLIENT, issuer: 'evil.example', expiresIn: '1h' });
  await assert.rejects(verify(otherIssuer), GoogleTokenError);
  await assert.rejects(verify(sign({}, { expiresIn: -60 })), /expired/);
  await assert.rejects(verify(sign({}, { key: other.privateKey })), GoogleTokenError, 'signed with a key Google didn’t publish');
  await assert.rejects(verify('not.a.token'), GoogleTokenError);
  const hs256 = jwt.sign({ sub: '1' }, 'shared-secret', { algorithm: 'HS256', keyid: 'key-1', audience: CLIENT, issuer: 'accounts.google.com' });
  await assert.rejects(verify(hs256), GoogleTokenError, 'only RS256 is accepted');
});

test('an unknown key id refetches Google’s keys once (rotation)', async () => {
  await assert.rejects(verify(sign({}, { kid: 'key-2' })), /not recognised/);
  assert.equal(fetches, 2);
});

test('without GOOGLE_CLIENT_ID nothing is accepted', async () => {
  await assert.rejects(verifyGoogleIdToken(sign(), { clientId: null, fetchImpl }), /isn’t set up/);
});

test('linking a Google account to members', () => {
  const identity = identityFromGoogle({ sub: '1098', email: 'Priya@Gmail.com', email_verified: true, name: 'Priya S', picture: 'https://x/p.jpg' });
  assert.equal(identity.email, 'priya@gmail.com');
  const linked = { _id: 'm1', googleSub: '1098' };
  assert.equal(decideGoogleLink({ identity, bySub: linked }).action, 'use');
  // Same verified email: link, even if the member used Google through Firebase before.
  assert.equal(decideGoogleLink({ identity, byEmail: { _id: 'm2', firebaseUid: 'fb-123' } }).action, 'link');
  assert.deepEqual(decideGoogleLink({ identity, byEmail: { _id: 'm3', googleSub: '9999' } }), { action: 'refuse', code: 'EMAIL_IN_USE' });
  assert.deepEqual(decideGoogleLink({ identity }), { action: 'create', name: 'Priya S' });
  assert.deepEqual(decideGoogleLink({ identity: identityFromGoogle({ sub: '1', email: 'a@b.com', email_verified: false }) }), { action: 'refuse', code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
  assert.deepEqual(decideGoogleLink({ identity: identityFromGoogle({ sub: '1', email: 'kiran.j@gmail.com', email_verified: true }) }), { action: 'create', name: 'kiran.j' });
});
