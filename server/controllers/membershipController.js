import Member from '../models/Member.js';
import MemberProfile from '../models/MemberProfile.js';
import Membership from '../models/Membership.js';
import PlanHistory from '../models/PlanHistory.js';
import Payment from '../models/Payment.js';
import { getSettingsDoc } from '../models/Settings.js';
import { addDays, getPlanOrThrow, planSnapshot, recordPlanHistory } from '../services/membershipService.js';
import { createPayment } from '../services/paymentService.js';
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

/**
 * Create a `pending` membership plus pending dues priced by the server.
 * The desk activates it by collecting payment (see paymentService.collectPendingPayment).
 */
async function requestPlan({ memberId, plan, settings, changeType, fromPlanId }, session) {
  const isFirstPlan = !(await Membership.exists({ memberId }).session(session));
  const snapshot = planSnapshot(plan);
  const now = new Date();
  const [membership] = await Membership.create(
    [
      {
        memberId,
        ...snapshot,
        startDate: now,
        endDate: addDays(now, snapshot.durationDays),
        status: 'pending',
        source: 'self',
      },
    ],
    { session }
  );
  await recordPlanHistory({ memberId, membershipId: membership._id, fromPlanId, toPlanId: plan._id, changeType }, session);

  const opts = { session, invoicePrefix: settings.invoicePrefix };
  const dues = [];
  const registrationFee = Number(settings.registrationFee) || 0;
  if (isFirstPlan && registrationFee > 0) {
    dues.push(await createPayment({ memberId, membershipId: membership._id, type: 'registration', amount: registrationFee, status: 'pending' }, opts));
  }
  if (snapshot.price > 0) {
    dues.push(
      await createPayment(
        { memberId, membershipId: membership._id, type: isFirstPlan ? 'membership' : 'renewal', amount: snapshot.price, status: 'pending' },
        opts
      )
    );
  }
  return { membership, amountDue: dues.reduce((sum, p) => sum + p.amount, 0) };
}

async function assertNoOpenMembership(memberId) {
  const open = await Membership.findOne({ memberId, status: { $in: ['active', 'pending', 'upcoming'] } }).lean();
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

    const result = await requestPlan({ memberId, plan, settings, changeType: 'join' }, session);
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
    Membership.find({ memberId, status: { $in: ['active', 'pending', 'upcoming'] } }).populate('planId').sort({ startDate: 1 }).lean(),
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
    membership: pick('active') || pick('pending') || pick('upcoming'),
    upcoming: pick('upcoming'),
    dues: { amount: dues.reduce((sum, p) => sum + p.amount, 0), count: dues.length },
  });
});

/** GET /api/membership/:userId — staff, or the member themself. */
export const getByMemberId = asyncHandler(async (req, res) => {
  const paramId = req.params.userId || req.params.memberId;
  const membership = await Membership.findOne({ memberId: paramId, status: 'active' }).populate('planId').lean();
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
  const [newPlan, settings, current] = await Promise.all([
    getPlanOrThrow(newPlanId),
    getSettingsDoc(),
    Membership.findOne({ memberId, status: 'active' }).lean(),
  ]);

  const { membership, amountDue } = await withTransaction((session) =>
    requestPlan(
      { memberId, plan: newPlan, settings, changeType: changeType || 'renew', fromPlanId: current?.planId },
      session
    )
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
  const pending = await Membership.findOne({ memberId, status: 'pending' });
  if (pending) {
    pending.status = 'cancelled';
    await pending.save();
    await Payment.updateMany({ membershipId: pending._id, status: 'pending' }, { $set: { status: 'failed', note: 'Request withdrawn by member' } });
    return res.json({ success: true, message: 'Request withdrawn' });
  }
  const m = await Membership.findOne({ memberId, status: 'active' });
  if (!m) throw new AppError('No active membership', 400, 'NO_ACTIVE');
  m.status = 'cancelled';
  await m.save();
  res.json({ success: true, message: 'Membership cancelled' });
});

/** GET /api/membership/history/me */
export const history = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const hist = await PlanHistory.find({ memberId }).sort({ changedAt: -1 }).populate('toPlanId fromPlanId').lean();
  const past = await Membership.find({ memberId }).sort({ createdAt: -1 }).populate('planId').lean();
  res.json({ success: true, planHistory: hist, memberships: past });
});
