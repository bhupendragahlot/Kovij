import Member from '../models/Member.js';
import MemberProfile from '../models/MemberProfile.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

function computeBmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return undefined;
  const h = Number(heightCm) / 100;
  if (!h) return undefined;
  return Math.round((Number(weightKg) / (h * h)) * 10) / 10;
}

export const getMyProfile = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.member.memberId).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const profile = await MemberProfile.findOne({ memberId: member._id }).lean();
  res.json({ success: true, member, profile });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const b = req.validated?.body || {};
  const memberId = req.member.memberId;

  const member = await Member.findById(memberId);
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');

  if (b.name) member.name = b.name;
  if (b.phone) member.phone = b.phone;
  if (b.dob) member.dob = b.dob;
  if (b.gender) member.gender = b.gender;
  if (b.address) {
    member.address = {
      city: b.address.city ?? member.address?.city,
      state: b.address.state ?? member.address?.state,
      line1: b.address.line1 ?? member.address?.line1,
    };
  }
  await member.save();

  const patch = {};
  if (b.heightCm != null) patch.heightCm = b.heightCm;
  if (b.weightKg != null) patch.weightKg = b.weightKg;
  if (b.bloodGroup != null) patch.bloodGroup = b.bloodGroup;
  if (b.medicalHas != null) patch.medicalCondition = { has: b.medicalHas, details: b.medicalDetails || '' };
  if (b.injuries != null) patch.injuries = b.injuries;
  if (b.allergies != null) patch.allergies = b.allergies;
  if (b.goalKind != null) patch.fitnessGoal = { goalKind: b.goalKind, customText: b.goalCustomText || '' };

  const heightForBmi = b.heightCm ?? undefined;
  const weightForBmi = b.weightKg ?? undefined;
  if (heightForBmi != null || weightForBmi != null) {
    const existing = await MemberProfile.findOne({ memberId }).lean();
    const h = heightForBmi ?? existing?.heightCm;
    const w = weightForBmi ?? existing?.weightKg;
    const bmiVal = computeBmi(h, w);
    if (bmiVal != null) patch.bmi = bmiVal;
  }

  let profile = await MemberProfile.findOneAndUpdate(
    { memberId },
    { $set: { memberId, ...patch } },
    { new: true, upsert: true }
  ).lean();

  res.json({ success: true, member: member.toObject(), profile });
});

