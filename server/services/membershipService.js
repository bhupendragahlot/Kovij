import Plan from '../models/Plan.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import PlanHistory from '../models/PlanHistory.js';
import { AppError } from '../middleware/errorHandler.js';
import { dayjs } from '../utils/time.js';

const DURATION_DAYS = { day: 1, week: 7, month: 30, quarter: 90, half_year: 182, year: 365 };

/** Map a plan's duration to days; an explicit `durationInDays` wins. */
export function planDurationToDays(plan) {
  if (plan?.durationInDays != null && Number.isFinite(Number(plan.durationInDays))) {
    return Math.max(1, Math.floor(Number(plan.durationInDays)));
  }
  return DURATION_DAYS[plan?.duration] ?? 30;
}

/** Tolerates legacy string prices such as "₹1,499". */
export function parsePlanPrice(plan) {
  const p = plan?.price;
  const n = typeof p === 'number' ? p : parseFloat(String(p).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** @param {Date} start @param {number} days */
export function addDays(start, days) {
  return dayjs(start).add(days, 'day').toDate();
}

/** @param {Date} start */
export function computeEndDate(start, plan) {
  return addDays(start, planDurationToDays(plan));
}

/** Remaining value credit from current plan (simple linear proration). */
export function prorationCredit(now, startDate, endDate, oldPlanPrice) {
  const totalMs = Math.max(1, new Date(endDate) - new Date(startDate));
  const leftMs = Math.max(0, new Date(endDate) - new Date(now));
  return Math.round(oldPlanPrice * (leftMs / totalMs) * 100) / 100;
}

export async function getPlanOrThrow(planId, session) {
  const plan = await Plan.findById(planId).session(session ?? null);
  if (!plan || plan.status === 'Inactive') {
    throw new AppError('This plan is not available', 404, 'PLAN_NOT_FOUND');
  }
  return plan;
}

/** Price/name/duration frozen onto the membership at purchase time. */
export function planSnapshot(plan, priceOverride) {
  return {
    planId: plan._id,
    planName: plan.name,
    price: priceOverride ?? parsePlanPrice(plan),
    durationDays: planDurationToDays(plan),
  };
}

/**
 * Derive a member's standing from their memberships.
 * @returns {'active'|'upcoming'|'pending'|'expired'|'none'}
 */
export async function currentMembershipState(memberId) {
  const memberships = await Membership.find({ memberId })
    .select('status startDate endDate planName planId')
    .sort({ endDate: -1 })
    .lean();
  const active = memberships.find((m) => m.status === 'active');
  if (active) return { state: 'active', membership: active };
  const pending = memberships.find((m) => m.status === 'pending');
  if (pending) return { state: 'pending', membership: pending };
  const upcoming = memberships.find((m) => m.status === 'upcoming');
  if (upcoming) return { state: 'upcoming', membership: upcoming };
  const ended = memberships.find((m) => m.status === 'expired' || m.status === 'cancelled');
  if (ended) return { state: 'expired', membership: ended };
  return { state: 'none', membership: null };
}

/**
 * A self-joined membership waits in `pending` until every due tied to it is paid.
 * Called inside the same transaction that marks a payment paid.
 * @returns the activated membership, or null if nothing changed
 */
export async function activateIfSettled(membershipId, session) {
  if (!membershipId) return null;
  const membership = await Membership.findById(membershipId).session(session);
  if (!membership || membership.status !== 'pending') return null;

  const outstanding = await Payment.exists({ membershipId, status: 'pending' }).session(session);
  if (outstanding) return null;

  const now = new Date();
  const current = await Membership.findOne({ memberId: membership.memberId, status: 'active' }).session(session);
  const startDate = current && current.endDate > now ? current.endDate : now;
  membership.startDate = startDate;
  membership.endDate = addDays(startDate, membership.durationDays || 30);
  membership.status = startDate > now ? 'upcoming' : 'active';
  await membership.save({ session });
  return membership;
}

/**
 * Promote `upcoming` memberships whose start date has arrived, expiring whatever they replace.
 * Idempotent; run by the daily cron and safe to call at any time.
 */
export async function rollOverMemberships(now = new Date()) {
  const expired = await Membership.updateMany(
    { status: 'active', endDate: { $lt: now } },
    { $set: { status: 'expired' } }
  );
  const started = await Membership.updateMany(
    { status: 'upcoming', startDate: { $lte: now }, endDate: { $gte: now } },
    { $set: { status: 'active' } }
  );
  return { expired: expired.modifiedCount, started: started.modifiedCount };
}

export async function recordPlanHistory({ memberId, membershipId, fromPlanId, toPlanId, changeType, notes }, session) {
  await PlanHistory.create(
    [{ memberId, membershipId, fromPlanId: fromPlanId ?? null, toPlanId, changeType, notes: notes || '' }],
    { session }
  );
}
