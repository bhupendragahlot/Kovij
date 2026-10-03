/**
 * Which member does a verified Firebase sign-in belong to?
 *
 * Pure decision logic (the controller fetches the candidate records), so the linking rules,
 * which decide who can reach which account, are unit-tested in isolation.
 *
 * Rules
 *  1. A member already linked to this Firebase user: use it.
 *  2. Email/password accounts must verify their email first: nobody can claim a desk record, or
 *     reserve an email address, by typing someone else's email.
 *  3. A verified email (Google, or email/password after verification) links to the unlinked member
 *     with that email. If that member is linked to a different sign-in, refuse.
 *  4. A phone number from SMS sign-in is proven by the one-time code, so it links to the unlinked
 *     member with that number. Families often share a number: if several match, the person picks
 *     who they are, or chooses a new account.
 *  5. Otherwise create a new member, which needs a name.
 */
import { canonicalPhone } from '../utils/strings.js';

/** Normalise the verified token claims we rely on. */
export function identityFromClaims(decoded = {}) {
  const provider = decoded.firebase?.sign_in_provider || '';
  const email = typeof decoded.email === 'string' && decoded.email ? decoded.email.toLowerCase().trim() : undefined;
  return {
    uid: decoded.uid,
    provider,
    email,
    // Google accounts come with verified emails; password accounts only after the link is clicked.
    emailVerified: decoded.email_verified === true,
    // Only SMS sign-in proves the phone number.
    phone: provider === 'phone' ? canonicalPhone(decoded.phone_number) : undefined,
    name: typeof decoded.name === 'string' ? decoded.name.trim() : '',
    picture: typeof decoded.picture === 'string' ? decoded.picture : '',
  };
}

const idOf = (m) => String(m._id);

/** Claims from a verified "Sign in with Google" ID token (services/googleIdToken.js). */
export function identityFromGoogle(claims = {}) {
  return {
    googleSub: String(claims.sub || ''),
    email: typeof claims.email === 'string' && claims.email ? claims.email.toLowerCase().trim() : undefined,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: typeof claims.name === 'string' ? claims.name.trim() : '',
    picture: typeof claims.picture === 'string' ? claims.picture : '',
  };
}

/**
 * Which member a direct Google sign-in belongs to.
 *  1. The member already linked to this Google account (googleSub): use it.
 *  2. Otherwise the member with the same Google-verified email: link it. Google has proven the
 *     person owns that address, so this also covers members who used Google through Firebase
 *     before, or whom the desk registered with that email.
 *  3. Otherwise create a member (Google always gives a name; fall back to the email's name).
 * An email matched to a member already linked to a *different* Google account is refused.
 */
export function decideGoogleLink({ identity, bySub = null, byEmail = null }) {
  if (!identity.googleSub) return { action: 'refuse', code: 'GOOGLE_TOKEN_INVALID' };
  if (bySub) return { action: 'use', member: bySub };
  if (!identity.email || !identity.emailVerified) return { action: 'refuse', code: 'GOOGLE_EMAIL_NOT_VERIFIED' };
  if (byEmail) {
    if (byEmail.googleSub && byEmail.googleSub !== identity.googleSub) return { action: 'refuse', code: 'EMAIL_IN_USE' };
    return { action: 'link', member: byEmail };
  }
  const name = identity.name || identity.email.split('@')[0];
  return { action: 'create', name: name.slice(0, 120) };
}

/**
 * @param {object} input
 * @param {ReturnType<typeof identityFromClaims>} input.identity
 * @param {object|null} input.byUid        member already linked to identity.uid
 * @param {object|null} input.byEmail      member with identity.email (only looked up when verified)
 * @param {object[]}    input.phoneMatches members with identity.phone (only for SMS sign-in)
 * @param {string}      [input.chosenMemberId] a phoneMatches id, or 'new' for a new account
 * @param {string}      [input.name]       name typed by the person (for new accounts)
 * @returns {{ action: 'use'|'link'|'create'|'choose'|'needs_name'|'refuse', member?, name?, candidates?, code? }}
 */
export function decideMemberLink({ identity, byUid = null, byEmail = null, phoneMatches = [], chosenMemberId, name }) {
  if (byUid) return { action: 'use', member: byUid };

  if (identity.provider === 'password' && !identity.emailVerified) {
    return { action: 'refuse', code: 'EMAIL_NOT_VERIFIED' };
  }

  if (identity.email && identity.emailVerified && byEmail) {
    if (byEmail.firebaseUid && byEmail.firebaseUid !== identity.uid) return { action: 'refuse', code: 'EMAIL_IN_USE' };
    return { action: 'link', member: byEmail };
  }

  if (identity.phone && chosenMemberId !== 'new') {
    const free = phoneMatches.filter((m) => !m.firebaseUid);
    const ask = { action: 'choose', candidates: free.map((m) => ({ id: idOf(m), name: m.name, memberCode: m.memberCode || '' })) };
    if (chosenMemberId) {
      const chosen = free.find((m) => idOf(m) === String(chosenMemberId));
      if (chosen) return { action: 'link', member: chosen };
      // A stale or tampered choice is asked again rather than trusted.
      if (free.length) return ask;
    } else if (free.length === 1) {
      return { action: 'link', member: free[0] };
    } else if (free.length > 1) {
      return ask;
    }
  }

  const displayName = String(name || identity.name || '').trim();
  if (displayName.length < 2) return { action: 'needs_name' };
  return { action: 'create', name: displayName.slice(0, 120) };
}
