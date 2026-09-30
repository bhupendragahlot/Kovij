/**
 * Member entry QR codes.
 *
 *   KV1.<member id, base64url>.<version, base36>.<signature>
 *
 * The signature is an HMAC over everything before it, so a code can't be made up or edited
 * (for example to point at another member). The version lets the desk replace a lost or shared
 * code: the member's current version is stored in MemberQrKey and older codes are refused.
 * Codes stay short (about 45 characters) so the QR is easy to scan from a phone screen.
 *
 * The key comes from QR_SECRET. Without it, a key is derived from JWT_SECRET; set QR_SECRET in
 * production so rotating the session secret doesn't invalidate every printed card.
 *
 * Pure (no database), so it can be unit-tested and used by scripts.
 */
import crypto from 'crypto';

export const QR_PREFIX = 'KV1';
const SIG_CHARS = 22; // base64url characters kept from the HMAC (~131 bits)
const ID_PATTERN = /^[A-Za-z0-9_-]{16}$/; // 12-byte ObjectId in base64url
const VERSION_PATTERN = /^[0-9a-z]{1,8}$/;
const SIG_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${SIG_CHARS}}$`);

/** The HMAC key for QR codes. Throws when neither secret is configured. */
export function qrSigningKey(env = process.env) {
  if (env.QR_SECRET) return Buffer.from(String(env.QR_SECRET));
  if (!env.JWT_SECRET) throw new Error('Set QR_SECRET (or JWT_SECRET) to issue member QR codes');
  // Derived, not reused: the JWT secret itself never signs QR codes.
  return crypto.createHmac('sha256', String(env.JWT_SECRET)).update('kovij:member-qr:v1').digest();
}

const sign = (payload, key) => crypto.createHmac('sha256', key).update(payload).digest('base64url').slice(0, SIG_CHARS);

/** @param {{ memberId: string, version?: number }} input */
export function createQrToken({ memberId, version = 1 }, key = qrSigningKey()) {
  const id = String(memberId);
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new Error('memberId must be a 24-character hex id');
  const v = Math.floor(Number(version));
  if (!Number.isFinite(v) || v < 1) throw new Error('version must be a positive integer');
  const payload = `${QR_PREFIX}.${Buffer.from(id, 'hex').toString('base64url')}.${v.toString(36)}`;
  return `${payload}.${sign(payload, key)}`;
}

/** Cheap shape check (no signature check): does this string claim to be a member QR code? */
export const looksLikeQrToken = (code) => typeof code === 'string' && code.trim().startsWith(`${QR_PREFIX}.`);

/**
 * @returns {{ ok: true, memberId: string, version: number } | { ok: false, reason: 'format'|'signature' }}
 */
export function verifyQrToken(code, key = qrSigningKey()) {
  const parts = String(code ?? '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return { ok: false, reason: 'format' };
  const [prefix, idPart, versionPart, sig] = parts;
  if (!ID_PATTERN.test(idPart) || !VERSION_PATTERN.test(versionPart) || !SIG_PATTERN.test(sig)) {
    return { ok: false, reason: 'format' };
  }
  const expected = Buffer.from(sign(`${prefix}.${idPart}.${versionPart}`, key));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'signature' };
  const version = parseInt(versionPart, 36);
  if (!Number.isSafeInteger(version) || version < 1) return { ok: false, reason: 'format' };
  return { ok: true, memberId: Buffer.from(idPart, 'base64url').toString('hex'), version };
}
