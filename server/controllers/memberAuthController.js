import Member from '../models/Member.js';
import { verifyFirebaseIdToken } from '../config/firebaseAdmin.js';
import { signMemberToken } from '../services/tokenService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * POST /api/member/auth/google
 */
export const googleLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.validated?.body || {};
  if (!idToken) throw new AppError('idToken required', 400, 'BAD_REQUEST');

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(idToken, true);
  } catch (e) {
    throw new AppError('Invalid or expired Firebase token', 401, 'FIREBASE_AUTH_FAILED');
  }

  const firebaseUid = decoded.uid;
  const email = (decoded.email || '').toLowerCase();
  const name = decoded.name || email.split('@')[0] || 'Member';
  const profilePhoto = decoded.picture || '';

  let member = await Member.findOne({ firebaseUid });
  if (!member) {
    member = await Member.findOne({ email });
    if (member && member.firebaseUid !== firebaseUid) {
      member.firebaseUid = firebaseUid;
    }
  }

  if (!member) {
    member = await Member.create({
      firebaseUid,
      email: email || `${firebaseUid}@placeholder.local`,
      name,
      profilePhoto,
      role: 'user',
    });
  } else {
    member.name = name || member.name;
    member.profilePhoto = profilePhoto || member.profilePhoto;
    if (email) member.email = email;
    await member.save();
  }

  const token = signMemberToken(member);
  res.json({
    success: true,
    token,
    member: {
      id: member._id,
      email: member.email,
      name: member.name,
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
