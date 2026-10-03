/**
 * Verify a Google ID token from the "Sign in with Google" button (Google Identity Services).
 *
 * The browser gets a signed JWT from Google; we check its RS256 signature against Google's
 * published keys, that it was issued for our OAuth client (GOOGLE_CLIENT_ID), by Google, and is
 * still valid. No client secret is involved. Keys are cached as long as Google says (max-age)
 * and refetched once when a token names a key we don't have yet (Google rotates them).
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const DEFAULT_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

export class GoogleTokenError extends Error {}

export const googleClientId = (env = process.env) => String(env.GOOGLE_CLIENT_ID || '').trim() || null;

let cache = { keys: new Map(), expires: 0 };

/** Test hook: forget cached keys. */
export function resetGoogleKeyCache() {
  cache = { keys: new Map(), expires: 0 };
}

async function loadKeys({ fetchImpl = fetch, certsUrl = process.env.GOOGLE_CERTS_URL || DEFAULT_CERTS_URL, force = false } = {}) {
  if (!force && cache.expires > Date.now() && cache.keys.size) return cache.keys;
  const res = await fetchImpl(certsUrl);
  if (!res.ok) throw new GoogleTokenError(`Couldn’t reach Google to check the sign-in (${res.status})`);
  const body = await res.json();
  const keys = new Map();
  for (const jwk of body.keys || []) {
    if (!jwk.kid || jwk.kty !== 'RSA') continue;
    keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }).export({ type: 'spki', format: 'pem' }));
  }
  const maxAge = Number(String(res.headers?.get?.('cache-control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  cache = { keys, expires: Date.now() + Math.min(maxAge, 24 * 3600) * 1000 };
  return keys;
}

/**
 * @returns the verified claims: { sub, email, email_verified, name, picture, … }
 * @throws GoogleTokenError when the token isn't a valid Google sign-in for this client
 */
export async function verifyGoogleIdToken(token, { clientId = googleClientId(), fetchImpl, certsUrl } = {}) {
  if (!clientId) throw new GoogleTokenError('Google sign-in isn’t set up on this server (GOOGLE_CLIENT_ID)');
  const decoded = typeof token === 'string' ? jwt.decode(token, { complete: true }) : null;
  const kid = decoded?.header?.kid;
  if (!kid || decoded.header.alg !== 'RS256') throw new GoogleTokenError('Not a Google sign-in token');

  let keys = await loadKeys({ fetchImpl, certsUrl });
  if (!keys.has(kid)) keys = await loadKeys({ fetchImpl, certsUrl, force: true });
  const key = keys.get(kid);
  if (!key) throw new GoogleTokenError('Google sign-in key not recognised');

  try {
    return jwt.verify(token, key, { algorithms: ['RS256'], audience: clientId, issuer: ISSUERS, clockTolerance: 30 });
  } catch (err) {
    throw new GoogleTokenError(err.name === 'TokenExpiredError' ? 'The Google sign-in expired' : 'The Google sign-in couldn’t be verified');
  }
}
