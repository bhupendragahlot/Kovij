import Member from '../models/Member.js';
import { verifyFirebaseIdToken } from '../config/firebaseAdmin.js';
import { signMemberToken } from '../services/tokenService.js';
import { nextMemberCode } from '../services/memberService.js';
import { decideGoogleLink, decideMemberLink, identityFromClaims, identityFromGoogle } from '../services/memberIdentity.js';
import { GoogleTokenError, googleClientId, verifyGoogleIdToken } from '../services/googleIdToken.js';
import { getSettingsDoc } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { isTestOtpOn, matchesTestOtp, testOtpCode } from '../services/testOtp.js';

const REFUSALS = {
  EMAIL_NOT_VERIFIED: ['Verify your email first. Open the link we sent you, then sign in again.', 403],
  EMAIL_IN_USE: ['This email already belongs to an account that signs in another way. Use the method you used before.', 409],
};

/** Fill in details the member hasn't given yet; never overwrite what they or the desk entered. */
function fillBlanks(member, identity) {
  if (!member.profilePhoto && identity.picture) member.profilePhoto = identity.picture;
  if (!member.email && identity.email && identity.emailVerified) member.email = identity.email;
  if (!member.phone && identity.phone) member.phone = identity.phone;
}

/** Attach the sign-in to an existing record, unless another sign-in claimed it first. */
async function linkMember(member, identity) {
  const linked = await Member.findOneAndUpdate(
    { _id: member._id, firebaseUid: { $exists: false } },
    { $set: { firebaseUid: identity.uid } },
    { new: true }
  );
  if (!linked) throw new AppError('This account was just linked to another sign-in. Sign in the way you did before.', 409, 'ALREADY_LINKED');
  return linked;
}

async function createMember(identity, name) {
  const settings = await getSettingsDoc();
  try {
    return await Member.create({
      firebaseUid: identity.uid,
      email: identity.emailVerified ? identity.email : undefined,
      phone: identity.phone,
      name,
      profilePhoto: identity.picture,
      memberCode: await nextMemberCode(settings.invoicePrefix),
      source: identity.provider === 'google.com' ? 'google' : 'app',
      role: 'user',
    });
  } catch (err) {
    // A double tap raced us to create the same sign-in: use the record that won.
    if (err?.code === 11000 && err.keyPattern?.firebaseUid && identity.uid) return Member.findOne({ firebaseUid: identity.uid });
    throw err;
  }
}

/**
 * Find (or create) the member a verified identity belongs to and answer with a session.
 * Identities without a Firebase uid (test-code phone sign-in) are matched by phone only and
 * never linked to a sign-in, so real SMS sign-in can still link the record later.
 */
async function signIn(res, identity, { name, memberId } = {}) {
  const byUid = identity.uid ? await Member.findOne({ firebaseUid: identity.uid }) : null;
  const byEmail = !byUid && identity.email && identity.emailVerified ? await Member.findOne({ email: identity.email }) : null;
  let phoneMatches =
    !byUid && identity.phone ? await Member.find({ phone: identity.phone }).select('name memberCode firebaseUid').sort({ createdAt: 1 }).limit(10) : [];
  // With the test code the phone number is the whole identity, whatever else the member signs in with.
  if (!identity.uid) phoneMatches = phoneMatches.map((m) => Object.assign(m, { firebaseUid: undefined }));

  const decision = decideMemberLink({ identity, byUid, byEmail, phoneMatches, chosenMemberId: memberId, name });

  let member;
  switch (decision.action) {
    case 'use':
      member = decision.member;
      break;
    case 'link':
      member = identity.uid ? await linkMember(decision.member, identity) : await Member.findById(decision.member._id);
      break;
    case 'create':
      member = await createMember(identity, decision.name);
      break;
    case 'choose':
      throw new AppError('More than one member uses this phone number. Choose who you are.', 409, 'CHOOSE_MEMBER', { candidates: decision.candidates });
    case 'needs_name':
      throw new AppError('Tell us your name to create your account.', 422, 'NEEDS_NAME');
    default: {
      const [message, status] = REFUSALS[decision.code] || ['We couldn’t sign you in.', 403];
      throw new AppError(message, status, decision.code);
    }
  }

  if (decision.action !== 'create') {
    fillBlanks(member, identity);
    if (member.isModified()) {
      try {
        await member.save();
      } catch (err) {
        if (err?.code !== 11000) throw err;
        // A detail that's already on another record (e.g. that email) just stays blank here.
        member = await Member.findById(member._id);
      }
    }
  }

  sendSession(res, member, decision.action === 'create');
}

function sendSession(res, member, created) {
  res.status(created ? 201 : 200).json({
    success: true,
    token: signMemberToken(member),
    isNew: created,
    member: {
      id: member._id,
      email: member.email,
      name: member.name,
      phone: member.phone,
      profilePhoto: member.profilePhoto,
      role: member.role,
    },
  });
}

const GOOGLE_REFUSALS = {
  GOOGLE_TOKEN_INVALID: ['We couldn’t confirm your Google sign-in. Please try again.', 401],
  GOOGLE_EMAIL_NOT_VERIFIED: ['Your Google account’s email isn’t verified yet. Verify it with Google, or sign in another way.', 403],
  EMAIL_IN_USE: ['This email already belongs to a different Google account here. Sign in with that one.', 409],
};

/**
 * POST /api/member/auth/google-id — the "Sign in with Google" button (Google Identity Services).
 * Verifies Google's ID token for our OAuth client (GOOGLE_CLIENT_ID) and starts a member session.
 */
export const googleIdSignIn = asyncHandler(async (req, res) => {
  if (!googleClientId()) throw new AppError('Google sign-in isn’t set up yet. Use your mobile number or email.', 409, 'GOOGLE_SIGNIN_OFF');
  let claims;
  try {
    claims = await verifyGoogleIdToken(req.validated.body.credential);
  } catch (err) {
    if (!(err instanceof GoogleTokenError)) throw err;
    const [message, status] = GOOGLE_REFUSALS.GOOGLE_TOKEN_INVALID;
    throw new AppError(message, status, 'GOOGLE_TOKEN_INVALID');
  }

  const identity = identityFromGoogle(claims);
  const bySub = identity.googleSub ? await Member.findOne({ googleSub: identity.googleSub }) : null;
  const byEmail = !bySub && identity.email && identity.emailVerified ? await Member.findOne({ email: identity.email }) : null;
  const decision = decideGoogleLink({ identity, bySub, byEmail });

  let member;
  if (decision.action === 'use') member = decision.member;
  else if (decision.action === 'link') {
    // Claim it atomically, so two Google accounts can't race for the same record.
    member = await Member.findOneAndUpdate(
      { _id: decision.member._id, $or: [{ googleSub: { $exists: false } }, { googleSub: identity.googleSub }] },
      { $set: { googleSub: identity.googleSub } },
      { new: true }
    );
    if (!member) throw new AppError(...GOOGLE_REFUSALS.EMAIL_IN_USE, 'EMAIL_IN_USE');
  } else if (decision.action === 'create') {
    const settings = await getSettingsDoc();
    try {
      member = await Member.create({
        googleSub: identity.googleSub,
        email: identity.email,
        name: decision.name,
        profilePhoto: identity.picture,
        memberCode: await nextMemberCode(settings.invoicePrefix),
        source: 'google',
        role: 'user',
      });
    } catch (err) {
      // A double tap raced us: use the record that won.
      if (err?.code === 11000 && err.keyPattern?.googleSub) member = await Member.findOne({ googleSub: identity.googleSub });
      else throw err;
    }
  } else {
    const [message, status] = GOOGLE_REFUSALS[decision.code] || ['We couldn’t sign you in.', 403];
    throw new AppError(message, status, decision.code);
  }

  if (decision.action !== 'create') {
    fillBlanks(member, { picture: identity.picture, email: identity.email, emailVerified: identity.emailVerified });
    if (member.isModified()) {
      try {
        await member.save();
      } catch (err) {
        if (err?.code !== 11000) throw err;
        member = await Member.findById(member._id);
      }
    }
  }
  sendSession(res, member, decision.action === 'create');
});

/**
 * POST /api/member/auth/session (and the older /google)
 * Exchanges a Firebase ID token (Google, email/password or phone OTP) for a member session.
 */
export const createSession = asyncHandler(async (req, res) => {
  const { idToken, name, memberId } = req.validated?.body || {};
  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(idToken, true);
  } catch {
    throw new AppError('Your sign-in expired. Please try again.', 401, 'FIREBASE_AUTH_FAILED');
  }
  await signIn(res, identityFromClaims(decoded), { name, memberId });
});

/** GET /api/member/auth/config — how the app should do mobile sign-in. */
export const authConfig = asyncHandler(async (req, res) => {
  const test = testOtpCode();
  res.json({
    success: true,
    phoneSignIn: test ? 'test' : 'firebase',
    ...(test && { codeLength: test.length }),
    // Public OAuth client id for the "Sign in with Google" button; null = use Firebase's Google popup.
    googleClientId: googleClientId(),
  });
});

const testModeOff = () => new AppError('Mobile sign-in by SMS is handled by the app. Update the app and try again.', 409, 'OTP_TEST_OFF');

/** POST /api/member/auth/otp/request — test mode: nothing is sent; the app asks for the test code. */
export const requestTestOtp = asyncHandler(async (req, res) => {
  if (!isTestOtpOn()) throw testModeOff();
  res.json({ success: true, testMode: true, phone: req.validated.body.phone, message: 'Test mode: no SMS is sent. Enter the test code.' });
});

/** POST /api/member/auth/otp/verify — test mode: the fixed code signs in that phone number. */
export const verifyTestOtp = asyncHandler(async (req, res) => {
  if (!isTestOtpOn()) throw testModeOff();
  const { phone, code, name, memberId } = req.validated.body;
  if (!matchesTestOtp(code)) throw new AppError('That code is wrong. Check it and try again.', 401, 'OTP_WRONG', { fields: { code: 'Wrong code' } });
  await signIn(res, { uid: undefined, provider: 'phone', phone, email: undefined, emailVerified: false, name: '', picture: '' }, { name, memberId });
});

export const me = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.member.memberId).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  res.json({
    success: true,
    member: {
      id: member._id,
      email: member.email,
      name: member.name,
      phone: member.phone,
      profilePhoto: member.profilePhoto,
      address: member.address,
      dob: member.dob,
      gender: member.gender,
      role: member.role,
      createdAt: member.createdAt,
    },
  });
});
