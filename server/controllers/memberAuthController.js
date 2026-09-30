import Member from '../models/Member.js';
import { verifyFirebaseIdToken } from '../config/firebaseAdmin.js';
import { signMemberToken } from '../services/tokenService.js';
import { nextMemberCode } from '../services/memberService.js';
import { decideMemberLink, identityFromClaims } from '../services/memberIdentity.js';
import { getSettingsDoc } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

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
    if (err?.code === 11000 && err.keyPattern?.firebaseUid) return Member.findOne({ firebaseUid: identity.uid });
    throw err;
  }
}

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
  const identity = identityFromClaims(decoded);

  const byUid = await Member.findOne({ firebaseUid: identity.uid });
  const byEmail = !byUid && identity.email && identity.emailVerified ? await Member.findOne({ email: identity.email }) : null;
  const phoneMatches =
    !byUid && identity.phone ? await Member.find({ phone: identity.phone }).select('name memberCode firebaseUid').sort({ createdAt: 1 }).limit(10) : [];

  const decision = decideMemberLink({ identity, byUid, byEmail, phoneMatches, chosenMemberId: memberId, name });

  let member;
  switch (decision.action) {
    case 'use':
      member = decision.member;
      break;
    case 'link':
      member = await linkMember(decision.member, identity);
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

  res.status(decision.action === 'create' ? 201 : 200).json({
    success: true,
    token: signMemberToken(member),
    isNew: decision.action === 'create',
    member: {
      id: member._id,
      email: member.email,
      name: member.name,
      phone: member.phone,
      profilePhoto: member.profilePhoto,
      role: member.role,
    },
  });
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
