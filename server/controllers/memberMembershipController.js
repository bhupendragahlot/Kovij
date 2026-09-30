/**
 * Member app: my membership, its history, plans I can buy, renewal/plan-change requests, and my
 * membership card. Every response is `{ success, ... }`; shapes are documented in the module report.
 */
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import PlanHistory from '../models/PlanHistory.js';
import { getSettingsDoc } from '../models/Settings.js';
import {
  CURRENT_STATUSES,
  buildTimeline,
  cancelMembershipRecord,
  getPlanOrThrow,
  hasRun,
  membershipView,
  parsePlanPrice,
  planDurationToDays,
  settleFreezes,
} from '../services/membershipService.js';
import { requestMembership } from '../services/salesService.js';
import { findByIdempotencyKey } from '../services/paymentService.js';
import { queueEmail } from '../services/emailService.js';
import { withTransaction } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

async function loadStanding(memberId) {
  await settleFreezes({ memberId }).catch((e) => logger.warn(`settleFreezes(${memberId}) failed: ${e.message}`));
  const [memberships, dues] = await Promise.all([
    Membership.find({ memberId }).sort({ endDate: -1 }).lean(),
    Payment.find({ memberId, status: 'pending' }).select('amount type membershipId invoiceNo createdAt').sort({ createdAt: 1 }).lean(),
  ]);
  const pick = (s) => memberships.find((m) => m.status === s) || null;
  const current = memberships.find((m) => CURRENT_STATUSES.includes(m.status)) || null;
  const pending = pick('pending');
  const upcoming = pick('upcoming');
  const ended = memberships.find((m) => m.status === 'expired' || (m.status === 'cancelled' && hasRun(m))) || null;
  const state = current ? current.status : pending ? 'pending' : upcoming ? 'upcoming' : ended ? 'expired' : 'none';
  return { memberships, dues, current, pending, upcoming, ended, state };
}

/** GET /api/member/membership — where I stand today. */
export const getMyMembership = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  const { dues, current, pending, upcoming, ended, state } = await loadStanding(req.member.memberId);
  const now = new Date();
  const main = current || pending || upcoming || ended;
  const next = current ? upcoming || pending : null;
  const membership = membershipView(main, { now });
  res.json({
    success: true,
    state,
    endingSoon: Boolean(current && current.status === 'active' && membership.daysLeft <= (settings.expiringWindowDays || 7)),
    membership,
    next: membershipView(next, { now }),
    dues: {
      amount: dues.reduce((sum, p) => sum + p.amount, 0),
      count: dues.length,
      items: dues.map((p) => ({ id: String(p._id), type: p.type, amount: p.amount, invoiceNo: p.invoiceNo, membershipId: p.membershipId ? String(p.membershipId) : null })),
    },
    canRequestPlan: !pending && !upcoming,
  });
});

/** GET /api/member/membership/history — my timeline (no staff notes) and every plan I've had. */
export const getMyHistory = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const limit = req.validated.query.limit;
  const [history, memberships] = await Promise.all([
    PlanHistory.find({ memberId }).sort({ changedAt: -1 }).limit(limit).lean(),
    Membership.find({ memberId }).sort({ startDate: -1 }).lean(),
  ]);
  const planIds = [...new Set(history.flatMap((h) => [h.toPlanId, h.fromPlanId]).filter(Boolean).map(String))];
  const plans = await Plan.find({ _id: { $in: planIds } }).select('name').lean();
  const events = buildTimeline({
    history,
    memberships,
    planNames: new Map(plans.map((p) => [String(p._id), p.name])),
    includeNotes: false,
  })
    .slice(0, limit)
    .map(({ by, source, ...e }) => ({ ...e, byGym: source === 'desk' }));
  const now = new Date();
  res.json({
    success: true,
    events,
    memberships: memberships.filter((m) => m.status !== 'cancelled' || hasRun(m)).map((m) => membershipView(m, { now })),
  });
});

/** GET /api/member/membership/plans — plans I can buy or renew to. */
export const getPlans = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const [plans, settings, current, anyHistory] = await Promise.all([
    Plan.find({ status: { $ne: 'Inactive' } }).sort({ price: 1, createdAt: 1 }).lean(),
    getSettingsDoc(),
    Membership.findOne({ memberId, status: { $in: CURRENT_STATUSES } }).select('planId endDate').lean(),
    Membership.find({ memberId }).select('status startDate endDate').lean(),
  ]);
  const isFirstPlan = !anyHistory.some((m) => m.status !== 'cancelled' || hasRun(m));
  const currentPlanId = current ? String(current.planId) : null;
  res.json({
    success: true,
    isFirstPlan,
    registrationFee: isFirstPlan ? Number(settings.registrationFee) || 0 : 0,
    startsAfter: current?.endDate || null,
    plans: plans
      // Hidden plans stay renewable for the people already on them.
      .filter((p) => p.showOnFrontend !== false || String(p._id) === currentPlanId)
      .map((p) => ({
        id: String(p._id),
        name: p.name,
        price: parsePlanPrice(p),
        duration: p.duration,
        durationDays: planDurationToDays(p),
        description: p.description || '',
        features: p.features || [],
        popular: Boolean(p.popular),
        isCurrent: String(p._id) === currentPlanId,
      })),
  });
});

/**
 * POST /api/member/membership/requests { planId } — ask to join, renew or change plan.
 * Creates dues priced by the server; the plan starts once they're paid (online or at the desk).
 */
export const requestPlan = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const { planId } = req.validated.body;

  // Backstop: the dues for this key already exist, so the request was made.
  const existing = await findByIdempotencyKey(req.idempotencyKey && `${req.idempotencyKey}:plan`);
  if (existing) {
    const membership = await Membership.findById(existing.membershipId).lean();
    return res.json({ success: true, replayed: true, request: { id: String(membership._id), planName: membership.planName, status: membership.status } });
  }

  const [member, settings, plan, current] = await Promise.all([
    Member.findById(memberId).select('name email isActive').lean(),
    getSettingsDoc(),
    getPlanOrThrow(planId),
    Membership.findOne({ memberId, status: { $in: CURRENT_STATUSES } }).select('planId').lean(),
  ]);
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (plan.showOnFrontend === false && String(current?.planId) !== String(plan._id)) {
    throw new AppError('This plan is not available', 404, 'PLAN_NOT_FOUND');
  }

  const result = await withTransaction((session) => requestMembership({ memberId, plan, settings, idempotencyKey: req.idempotencyKey }, session));

  queueEmail({
    to: member.email,
    templateKey: 'joinReceived',
    vars: { name: member.name, planName: plan.name, amountDue: inr(result.amountDue), gymName: settings.gymName },
  }).catch(() => {});

  res.status(201).json({
    success: true,
    request: {
      id: String(result.membership._id),
      planId: String(plan._id),
      planName: plan.name,
      status: result.membership.status,
      changeType: result.changeType,
      amountDue: result.amountDue,
      startsAfter: result.startsAfter,
    },
    dues: result.dues.map((p) => ({ id: String(p._id), type: p.type, amount: p.amount, invoiceNo: p.invoiceNo })),
    message: result.amountDue > 0 ? `Pay ${inr(result.amountDue)} to confirm. Your plan starts once it's paid.` : 'Request received. The front desk will confirm it.',
  });
});

/** POST /api/member/membership/requests/:id/cancel — withdraw a request that hasn't been paid. */
export const cancelRequest = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const m = await Membership.findOne({ _id: req.validated.params.id, memberId }).lean();
  if (!m) throw new AppError('Request not found', 404, 'NOT_FOUND');
  if (m.status !== 'pending') throw new AppError('Only a request waiting for payment can be withdrawn', 409, 'NOT_CANCELLABLE');
  if (await Payment.exists({ membershipId: m._id, status: 'paid' })) {
    throw new AppError('Part of this is already paid. Ask the front desk to change it.', 409, 'PARTLY_PAID');
  }
  await withTransaction((session) => cancelMembershipRecord({ membershipId: m._id, memberId, source: 'self' }, session));
  res.json({ success: true, message: 'Request withdrawn' });
});

/** GET /api/member/membership/card — what the printable / in-app membership card shows. */
export const getCard = asyncHandler(async (req, res) => {
  const memberId = req.member.memberId;
  const [member, settings, standing] = await Promise.all([
    Member.findById(memberId).select('name memberCode profilePhoto joinedAt createdAt').lean(),
    getSettingsDoc(),
    loadStanding(memberId),
  ]);
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const m = standing.current || standing.upcoming || null;
  res.json({
    success: true,
    card: {
      memberId: String(member._id),
      name: member.name,
      memberCode: member.memberCode || null,
      photoUrl: member.profilePhoto || null,
      memberSince: member.joinedAt || member.createdAt,
      state: standing.state,
      planName: m?.planName || null,
      validFrom: m?.startDate || null,
      validUntil: m?.endDate || null,
      onHoldUntil: m?.status === 'paused' ? m.freeze?.endDate || null : null,
      gym: {
        name: settings.gymName,
        logoUrl: settings.logoUrl || null,
        phone: settings.phone || null,
        address: settings.address || null,
      },
    },
  });
});
