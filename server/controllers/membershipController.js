import Member from '../models/Member.js';
import MemberProfile from '../models/MemberProfile.js';
import Membership from '../models/Membership.js';
import PlanHistory from '../models/PlanHistory.js';
import Payment from '../models/Payment.js';
import { getSettingsDoc } from '../models/Settings.js';
import { CURRENT_STATUSES, cancelMembershipRecord, getPlanOrThrow } from '../services/membershipService.js';
import { requestMembership } from '../services/salesService.js';
import { nextMemberCode } from '../services/memberService.js';
import { queueEmail } from '../services/emailService.js';
import { withTransaction } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

function bmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return 0;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

async function assertNoOpenMembership(memberId) {
  const open = await Membership.findOne({ memberId, status: { $in: [...CURRENT_STATUSES, 'pending', 'upcoming'] } }).lean();
  if (!open) return;
  if (open.status === 'pending') {
    throw new AppError('Your registration is waiting for payment at the front desk', 409, 'PENDING_PAYMENT');
  }
  throw new AppError('You already have an active membership', 409, 'DUPLICATE_MEMBERSHIP');
}

/** POST /api/membership/join — online self-registration. */
export const join = asyncHandler(async (req, res) => {
  const { personalDetails, healthDetails, fitnessGoal, selectedPlanId, profilePhotoUrl, idProofUrl, idProofType } = req.validated.body;
  const memberId = req.member.memberId;

  await assertNoOpenMembership(memberId);
  const [plan, settings] = await Promise.all([getPlanOrThrow(selectedPlanId), getSettingsDoc()]);

  const { membership, amountDue, member } = await withTransaction(async (session) => {
    const current = await Member.findById(memberId).session(session);
    if (!current) throw new AppError('Member not found', 404, 'NOT_FOUND');
    current.set({
      name: personalDetails.fullName,
      phone: personalDetails.mobile,
      email: personalDetails.email.toLowerCase(),
      gender: personalDetails.gender,
      dob: new Date(new Date().getFullYear() - personalDetails.age, 0, 1),
      'address.city': personalDetails.address.city,
      'address.state': personalDetails.address.state,
      'address.line1': personalDetails.address.line1,
    });
    if (profilePhotoUrl) current.profilePhoto = profilePhotoUrl;
    if (!current.joinedAt) current.joinedAt = new Date();
    if (!current.memberCode) current.memberCode = await nextMemberCode(settings.invoicePrefix, session);
    await current.save({ session });

    await MemberProfile.findOneAndUpdate(
      { memberId },
      {
        memberId,
        heightCm: healthDetails.heightCm,
        weightKg: healthDetails.weightKg,
        bmi: bmi(healthDetails.heightCm, healthDetails.weightKg),
        bloodGroup: healthDetails.bloodGroup,
        medicalCondition: healthDetails.medicalCondition,
        injuries: healthDetails.injuries || '',
        allergies: healthDetails.allergies || '',
        fitnessGoal: { goalKind: fitnessGoal.goalKind, customText: fitnessGoal.customText || '' },
        ...(idProofUrl && { idProof: { type: idProofType || 'other', url: idProofUrl } }),
      },
      { upsert: true, session }
    );

    const result = await requestMembership({ memberId, plan, settings }, session);
    return { ...result, member: current.toObject() };
  });

  queueEmail({
    to: member.email,
    templateKey: 'joinReceived',
    vars: { name: member.name, planName: plan.name, amountDue: inr(amountDue), gymName: settings.gymName },
  }).catch(() => {});

  res.status(201).json({
    success: true,
    membership: {
      id: membership._id,
      planId: plan._id,
      planName: plan.name,
      status: membership.status,
      amountDue,
    },
  });
});

async function memberOverview(memberId) {
  const [memberships, profile, member, dues] = await Promise.all([
    Membership.find({ memberId, status: { $in: [...CURRENT_STATUSES, 'pending', 'upcoming'] } }).populate('planId').sort({ startDate: 1 }).lean(),
    MemberProfile.findOne({ memberId }).lean(),
    Member.findById(memberId).lean(),
    Payment.find({ memberId, status: 'pending' }).select('amount').lean(),
  ]);
  return { memberships, profile, member, dues };
}

/** GET /api/membership/me — current plan (active, else awaiting payment, else upcoming). */
export const getMine = asyncHandler(async (req, res) => {
  const { memberships, profile, member, dues } = await memberOverview(req.member.memberId);
  const pick = (s) => memberships.find((m) => m.status === s) || null;
  res.json({
    success: true,
    member,
    profile,
    membership: pick('active') || pick('paused') || pick('pending') || pick('upcoming'),
    upcoming: pick('upcoming'),
    dues: { amount: dues.reduce((sum, p) => sum + p.amount, 0), count: dues.length },
  });
});

/** GET /api/membership/:userId — staff, or the member themself. */
export const getByMemberId = asyncHandler(async (req, res) => {
  const paramId = req.params.userId || req.params.memberId;
  const membership = await Membership.findOne({ memberId: paramId, status: { $in: CURRENT_STATUSES } }).populate('planId').lean();
  const profile = await MemberProfile.findOne({ memberId: paramId }).lean();
  const member = await Member.findById(paramId).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  res.json({ success: true, member, profile, membership });
});

/**
 * POST /api/membership/update — member asks to renew or change plan.
 * Nothing changes until the desk collects the new plan's fee; it then starts when the
 * current plan ends (or immediately if there is none).
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const { newPlanId, changeType } = req.validated.body;
  const memberId = req.member.memberId;

  if (await Membership.exists({ memberId, status: { $in: ['pending', 'upcoming'] } })) {
    throw new AppError('You already have a plan change waiting', 409, 'RENEWAL_EXISTS');
  }
  const [newPlan, settings] = await Promise.all([getPlanOrThrow(newPlanId), getSettingsDoc()]);

  const { membership, amountDue } = await withTransaction((session) =>
    requestMembership({ memberId, plan: newPlan, settings, changeType }, session)
  );

  res.status(201).json({
    success: true,
    membership: { id: membership._id, planName: newPlan.name, status: membership.status, amountDue },
    message: `Pay ${inr(amountDue)} at the front desk to confirm.`,
  });
});

/** POST /api/membership/cancel — withdraw a waiting request, else cancel the active plan. */
export const cancel = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const pending = await Membership.findOne({ memberId, status: 'pending' }).lean();
  if (pending) {
    await withTransaction((session) => cancelMembershipRecord({ membershipId: pending._id, memberId, source: 'self' }, session));
    return res.json({ success: true, message: 'Request withdrawn' });
  }
  const m = await Membership.findOne({ memberId, status: { $in: CURRENT_STATUSES } }).lean();
  if (!m) throw new AppError('No active membership', 400, 'NO_ACTIVE');
  await withTransaction((session) => cancelMembershipRecord({ membershipId: m._id, memberId, source: 'self' }, session));
  res.json({ success: true, message: 'Membership cancelled' });
});

/** GET /api/membership/history/me */
export const history = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const hist = await PlanHistory.find({ memberId }).sort({ changedAt: -1 }).populate('toPlanId fromPlanId').lean();
  const past = await Membership.find({ memberId }).sort({ createdAt: -1 }).populate('planId').lean();
  res.json({ success: true, planHistory: hist, memberships: past });
});
