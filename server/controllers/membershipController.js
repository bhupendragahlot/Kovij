import mongoose from 'mongoose';
import Member from '../models/Member.js';
import MemberProfile from '../models/MemberProfile.js';
import Membership from '../models/Membership.js';
import PlanHistory from '../models/PlanHistory.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import { computeEndDate, getPlanOrThrow, parsePlanPrice, prorationCredit } from '../services/membershipService.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

function bmi(heightCm, weightKg) {
  if (!heightCm || !weightKg) return 0;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export const join = asyncHandler(async (req, res) => {
  const data = req.validated?.body || req.body;
  const { personalDetails, healthDetails, fitnessGoal, selectedPlanId, payment, profilePhotoUrl, idProofUrl, idProofType } = data;
  const memberId = req.member.memberId;

  const active = await Membership.findOne({ memberId, status: 'active' });
  if (active) {
    throw new AppError('You already have an active membership', 409, 'DUPLICATE_MEMBERSHIP');
  }

  const plan = await getPlanOrThrow(selectedPlanId);
  const now = new Date();
  const endDate = computeEndDate(now, plan);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await Member.findByIdAndUpdate(
      memberId,
      {
        name: personalDetails.fullName,
        phone: personalDetails.mobile,
        email: personalDetails.email.toLowerCase(),
        profilePhoto: profilePhotoUrl || undefined,
        address: {
          city: personalDetails.address.city,
          state: personalDetails.address.state,
          line1: personalDetails.address.line1,
        },
        gender: personalDetails.gender,
        dob: new Date(new Date().getFullYear() - personalDetails.age, 0, 1),
      },
      { session, new: true }
    );

    const bmiVal = bmi(healthDetails.heightCm, healthDetails.weightKg);

    await MemberProfile.findOneAndUpdate(
      { memberId },
      {
        memberId,
        heightCm: healthDetails.heightCm,
        weightKg: healthDetails.weightKg,
        bmi: bmiVal,
        bloodGroup: healthDetails.bloodGroup,
        medicalCondition: healthDetails.medicalCondition,
        injuries: healthDetails.injuries || '',
        allergies: healthDetails.allergies || '',
        fitnessGoal: {
          goalKind: fitnessGoal.goalKind,
          customText: fitnessGoal.customText || '',
        },
        idProof: {
          type: idProofType || 'other',
          url: idProofUrl || '',
        },
      },
      { upsert: true, session, new: true }
    );

    const membership = await Membership.create(
      [
        {
          memberId,
          planId: plan._id,
          startDate: now,
          endDate,
          status: 'active',
        },
      ],
      { session }
    );
    const memDoc = membership[0];

    await PlanHistory.create(
      [
        {
          memberId,
          membershipId: memDoc._id,
          fromPlanId: null,
          toPlanId: plan._id,
          changeType: 'join',
          prorationAmount: 0,
        },
      ],
      { session }
    );

    if (payment.registrationFee > 0) {
      await Payment.create(
        [
          {
            memberId,
            membershipId: memDoc._id,
            type: 'registration',
            amount: payment.registrationFee,
            mode: payment.mode,
            status: payment.status,
            paidAt: payment.status === 'paid' ? now : undefined,
          },
        ],
        { session }
      );
    }
    if (payment.membershipFee > 0) {
      await Payment.create(
        [
          {
            memberId,
            membershipId: memDoc._id,
            type: 'membership',
            amount: payment.membershipFee,
            mode: payment.mode,
            status: payment.status,
            paidAt: payment.status === 'paid' ? now : undefined,
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    const member = await Member.findById(memberId).lean();
    queueEmail({
      to: member.email,
      templateKey: 'welcome',
      vars: {
        name: member.name,
        planName: plan.name,
        startDate: now,
        endDate: endDate,
      },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      membership: {
        id: memDoc._id,
        planId: plan._id,
        planName: plan.name,
        startDate: memDoc.startDate,
        endDate: memDoc.endDate,
        status: memDoc.status,
      },
    });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
});

export const getMine = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const membership = await Membership.findOne({ memberId, status: 'active' })
    .populate('planId')
    .lean();
  const profile = await MemberProfile.findOne({ memberId }).lean();
  const member = await Member.findById(memberId).lean();
  res.json({
    success: true,
    member,
    profile,
    membership,
  });
});

export const getByMemberId = asyncHandler(async (req, res) => {
  const paramId = req.params.userId || req.params.memberId;

  const membership = await Membership.findOne({ memberId: paramId, status: 'active' })
    .populate('planId')
    .lean();
  const profile = await MemberProfile.findOne({ memberId: paramId }).lean();
  const member = await Member.findById(paramId).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');

  res.json({ success: true, member, profile, membership });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const { newPlanId, changeType: bodyChangeType } = req.validated?.body || req.body;
  const memberId = req.member.memberId;

  const current = await Membership.findOne({ memberId, status: 'active' });
  if (!current) throw new AppError('No active membership', 400, 'NO_ACTIVE');

  const oldPlan = await Plan.findById(current.planId);
  const newPlan = await getPlanOrThrow(newPlanId);
  if (String(current.planId) === String(newPlan._id)) {
    throw new AppError('Already on this plan', 400, 'SAME_PLAN');
  }

  const oldPrice = parsePlanPrice(oldPlan);
  const newPrice = parsePlanPrice(newPlan);
  const now = new Date();
  let inferredChange = bodyChangeType;
  if (!inferredChange) {
    inferredChange = newPrice >= oldPrice ? 'upgrade' : 'downgrade';
  }

  const credit = prorationCredit(now, current.startDate, current.endDate, oldPrice);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    current.status = 'expired';
    await current.save({ session });

    const startDate = now;
    const endDate = computeEndDate(startDate, newPlan);

    const [newMem] = await Membership.create(
      [
        {
          memberId,
          planId: newPlan._id,
          startDate,
          endDate,
          status: 'active',
        },
      ],
      { session }
    );

    await PlanHistory.create(
      [
        {
          memberId,
          membershipId: newMem._id,
          fromPlanId: oldPlan?._id,
          toPlanId: newPlan._id,
          changeType: inferredChange,
          prorationAmount: credit,
          notes: `Credit from remaining value ~${credit}`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const member = await Member.findById(memberId).lean();
    queueEmail({
      to: member.email,
      templateKey: 'planUpdated',
      vars: {
        name: member.name,
        planName: newPlan.name,
        startDate: startDate,
        endDate: endDate,
        changeType: inferredChange,
      },
    }).catch(() => {});

    res.json({
      success: true,
      membership: {
        id: newMem._id,
        planId: newPlan._id,
        planName: newPlan.name,
        startDate: newMem.startDate,
        endDate: newMem.endDate,
        status: newMem.status,
        prorationCredit: credit,
      },
    });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    throw e;
  }
});

export const cancel = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const m = await Membership.findOne({ memberId, status: 'active' });
  if (!m) throw new AppError('No active membership', 400, 'NO_ACTIVE');
  m.status = 'cancelled';
  await m.save();
  res.json({ success: true, message: 'Membership cancelled' });
});

export const history = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const hist = await PlanHistory.find({ memberId }).sort({ changedAt: -1 }).populate('toPlanId fromPlanId').lean();
  const past = await Membership.find({ memberId }).sort({ createdAt: -1 }).populate('planId').lean();
  res.json({ success: true, planHistory: hist, memberships: past });
});
