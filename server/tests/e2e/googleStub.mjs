/**
 * Stand-in for Google's public sign-in keys, so the e2e suite can test "Sign in with Google"
 * without Google. Serves a JWKS for a throwaway RSA key; flows sign ID tokens with the private
 * key (passed to them as E2E_GOOGLE_KEY) the way Google would.
 */
import crypto from 'node:crypto';
import http from 'node:http';

export const E2E_GOOGLE_CLIENT_ID = 'e2e-client.apps.googleusercontent.com';

export async function startGoogleStub() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'e2e-key', alg: 'RS256', use: 'sig' };
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    certsUrl: `http://127.0.0.1:${server.address().port}/certs`,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
