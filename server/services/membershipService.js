import Plan from '../models/Plan.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import PlanHistory from '../models/PlanHistory.js';
import { AppError } from '../middleware/errorHandler.js';
import { dayjs, gymDayKey, parseGymDay } from '../utils/time.js';
import { withTransaction } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const DURATION_DAYS = { day: 1, week: 7, month: 30, quarter: 90, half_year: 182, year: 365 };

/** Limits for holds and complimentary days. Kept in one place so the owner can tune them. */
export const FREEZE_POLICY = {
  minDays: 1,
  maxDays: 90,
  /** How far ahead a freeze may be booked. */
  maxStartAheadDays: 30,
};
export const EXTEND_POLICY = { minDays: 1, maxDays: 90 };

/** A plan that is running (or on hold) right now. */
export const CURRENT_STATUSES = ['active', 'paused'];
/** A plan that blocks selling another one until it is dealt with. */
export const WAITING_STATUSES = ['upcoming', 'pending'];

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

/** @param {Date} start @param {number} days (may be negative) */
export function addDays(start, days) {
  return dayjs(start).add(days, 'day').toDate();
}

/** @param {Date} start */
export function computeEndDate(start, plan) {
  return addDays(start, planDurationToDays(plan));
}

/** Whole gym-calendar days from `a` to `b` (negative when `b` is earlier). */
export function gymDaysBetween(a, b) {
  return parseGymDay(gymDayKey(b)).diff(parseGymDay(gymDayKey(a)), 'day');
}

/** Days left on a plan counted in gym days: 0 on its last day, negative once it has ended. */
export function daysLeft(endDate, now = new Date()) {
  if (!endDate) return null;
  return gymDaysBetween(now, endDate);
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
 * What kind of sale this is, for the timeline and renewal reports.
 *   first plan ever → join; same plan → renew; a different plan → upgrade when it costs at least
 *   as much as the one it follows, otherwise downgrade.
 */
export function saleChangeType({ isFirstPlan, previous, planId, price }) {
  if (isFirstPlan) return 'join';
  if (!previous || String(previous.planId) === String(planId)) return 'renew';
  return Number(price) >= Number(previous.price || 0) ? 'upgrade' : 'downgrade';
}

/** A membership that actually ran for some time (cancelled requests never did). */
export const hasRun = (m) => new Date(m.startDate) < new Date(m.endDate);

/**
 * Derive a member's standing from their memberships.
 *   state: 'active' | 'paused' | 'pending' | 'upcoming' | 'expired' | 'none'
 * While frozen, `membership.pauseEndsAt` is the day the plan resumes (check-in shows "On hold until …").
 * Freezes that are due to start or end are applied first, so the answer is right even between job runs.
 */
export async function currentMembershipState(memberId) {
  await settleFreezes({ memberId }).catch((e) => logger.warn(`settleFreezes(${memberId}) failed: ${e.message}`));
  const memberships = await Membership.find({ memberId })
    .select('status startDate endDate planName planId freeze')
    .sort({ endDate: -1 })
    .lean();
  const active = memberships.find((m) => m.status === 'active');
  if (active) return { state: 'active', membership: active };
  const paused = memberships.find((m) => m.status === 'paused');
  if (paused) return { state: 'paused', membership: { ...paused, pauseEndsAt: paused.freeze?.endDate || null } };
  const pending = memberships.find((m) => m.status === 'pending');
  if (pending) return { state: 'pending', membership: pending };
  const upcoming = memberships.find((m) => m.status === 'upcoming');
  if (upcoming) return { state: 'upcoming', membership: upcoming };
  const ended = memberships.find((m) => m.status === 'expired' || (m.status === 'cancelled' && hasRun(m)));
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
  const current = await Membership.findOne({ memberId: membership.memberId, status: { $in: CURRENT_STATUSES } }).session(session);
  const startDate = current && current.endDate > now ? current.endDate : now;
  membership.startDate = startDate;
  membership.endDate = addDays(startDate, membership.durationDays || 30);
  membership.status = startDate > now ? 'upcoming' : 'active';
  await membership.save({ session });
  return membership;
}

/**
 * Daily roll-over: apply freezes that start or end, expire plans that have ended, and start queued
 * renewals whose day has come. Idempotent; run by the daily cron and safe to call at any time.
 */
export async function rollOverMemberships(now = new Date()) {
  const freezes = await settleFreezes({ now });
  const expired = await Membership.updateMany(
    { status: 'active', endDate: { $lt: now } },
    { $set: { status: 'expired' } }
  );
  const started = await Membership.updateMany(
    { status: 'upcoming', startDate: { $lte: now }, endDate: { $gte: now } },
    { $set: { status: 'active' } }
  );
  return { expired: expired.modifiedCount, started: started.modifiedCount, ...freezes };
}

export async function recordPlanHistory(
  { memberId, membershipId, fromPlanId, toPlanId, changeType, notes, days, amount, effectiveFrom, effectiveTo, source, createdBy, idempotencyKey },
  session
) {
  const [row] = await PlanHistory.create(
    [
      {
        memberId,
        membershipId,
        fromPlanId: fromPlanId ?? null,
        toPlanId,
        changeType,
        notes: notes || '',
        days,
        amount,
        effectiveFrom,
        effectiveTo,
        source: source || 'desk',
        createdBy,
        idempotencyKey: idempotencyKey || undefined,
      },
    ],
    { session }
  );
  return row;
}

/**
 * Move queued renewals by `days` when the plan in front of them gets longer or shorter,
 * so a renewal never starts while the current plan is still running (or on hold).
 */
async function shiftQueuedPlans({ memberId, excludeId, days }, session) {
  if (!days) return 0;
  const ms = days * 86_400_000;
  const res = await Membership.updateMany(
    { memberId, _id: { $ne: excludeId }, status: 'upcoming' },
    [{ $set: { startDate: { $add: ['$startDate', ms] }, endDate: { $add: ['$endDate', ms] } } }],
    { session }
  );
  return res.modifiedCount;
}

// ── Freeze, unfreeze, extend ────────────────────────────────────────────────

/**
 * Check a freeze request against the plan and the policy, and work out its dates.
 * Pure: used by the service and the unit tests.
 * @param {{ membership: {status:string, endDate:Date, freeze?:object}, startDay?: string, days: number, now?: Date }} input
 */
export function planFreeze({ membership, startDay, days, now = new Date() }) {
  if (membership.freeze) {
    throw new AppError('This plan already has a freeze booked. Unfreeze it before adding another.', 409, 'ALREADY_FROZEN');
  }
  if (membership.status !== 'active') {
    throw new AppError('Only an active plan can be frozen', 409, 'NOT_FREEZABLE');
  }
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < FREEZE_POLICY.minDays || n > FREEZE_POLICY.maxDays) {
    throw new AppError(`Freeze for ${FREEZE_POLICY.minDays} to ${FREEZE_POLICY.maxDays} days`, 422, 'VALIDATION_ERROR', {
      fields: { days: `Enter ${FREEZE_POLICY.minDays} to ${FREEZE_POLICY.maxDays} days` },
    });
  }
  const start = parseGymDay(startDay || gymDayKey(now));
  const ahead = gymDaysBetween(now, start.toDate());
  if (ahead < 0) {
    throw new AppError('A freeze can’t start in the past. To give back missed days, extend the plan instead.', 422, 'VALIDATION_ERROR', {
      fields: { startDate: 'Choose today or a later date' },
    });
  }
  if (ahead > FREEZE_POLICY.maxStartAheadDays) {
    throw new AppError(`A freeze can be booked up to ${FREEZE_POLICY.maxStartAheadDays} days ahead`, 422, 'VALIDATION_ERROR', {
      fields: { startDate: `Choose a date in the next ${FREEZE_POLICY.maxStartAheadDays} days` },
    });
  }
  const startDate = start.toDate();
  if (startDate >= new Date(membership.endDate)) {
    throw new AppError('The plan ends before this freeze would start', 422, 'VALIDATION_ERROR', {
      fields: { startDate: 'Choose a date before the plan ends' },
    });
  }
  return {
    startDate,
    resumeDate: start.add(n, 'day').toDate(),
    days: n,
    newEndDate: addDays(membership.endDate, n),
    startsNow: startDate <= now,
  };
}

/**
 * How a freeze ends at `at`: days actually frozen (gym days, 0 if it never started) and the
 * unused days to give back. Pure.
 */
export function freezeOutcome(freeze, at) {
  const daysFrozen = Math.min(freeze.days, Math.max(0, gymDaysBetween(freeze.startDate, at)));
  return { daysFrozen, unusedDays: freeze.days - daysFrozen, started: new Date(at) >= new Date(freeze.startDate) };
}

async function loadMembership(membershipId, session) {
  const m = await Membership.findById(membershipId).session(session);
  if (!m) throw new AppError('Membership not found', 404, 'NOT_FOUND');
  return m;
}

/**
 * Put an active plan on hold from `startDay` for `days` gym days. The plan's end date moves out by
 * `days` straight away (and any queued renewal with it); an early unfreeze gives unused days back.
 */
export async function freezeMembership({ membershipId, startDay, days, reason, staff, idempotencyKey, now = new Date() }, session) {
  const m = await loadMembership(membershipId, session);
  const plan = planFreeze({ membership: m, startDay, days, now });

  m.freeze = { startDate: plan.startDate, endDate: plan.resumeDate, days: plan.days, reason: reason || '', createdBy: staff?.id, createdAt: now };
  m.endDate = plan.newEndDate;
  if (plan.startsNow) m.status = 'paused';
  await m.save({ session });
  await shiftQueuedPlans({ memberId: m.memberId, excludeId: m._id, days: plan.days }, session);

  const event = await recordPlanHistory(
    {
      memberId: m.memberId,
      membershipId: m._id,
      toPlanId: m.planId,
      changeType: 'freeze',
      days: plan.days,
      effectiveFrom: plan.startDate,
      effectiveTo: plan.resumeDate,
      notes: reason,
      createdBy: staff?.id,
      idempotencyKey,
    },
    session
  );
  return { membership: m, event };
}

/**
 * End a freeze. `how`:
 *   manual     staff unfroze it now (unused days are given back)
 *   scheduled  it ran its course (called by settleFreezes)
 * A freeze that hasn't started yet is simply removed ("cancelled").
 * Pass `freezeId` to act only if that exact freeze is still in place (safe for concurrent jobs).
 */
export async function unfreezeMembership({ membershipId, freezeId, how = 'manual', staff, idempotencyKey, now = new Date() }, session) {
  const m = await loadMembership(membershipId, session);
  if (!m.freeze || (freezeId && String(m.freeze._id) !== String(freezeId))) {
    throw new AppError('This plan isn’t frozen', 409, 'NOT_FROZEN');
  }
  const freeze = m.freeze;
  const at = how === 'scheduled' ? freeze.endDate : now;
  const { daysFrozen, unusedDays, started } = freezeOutcome(freeze, at);
  const endedHow = how === 'scheduled' ? 'scheduled' : started ? 'manual' : 'cancelled';

  if (unusedDays > 0) m.endDate = addDays(m.endDate, -unusedDays);
  if (!m.freezeHistory) m.freezeHistory = [];
  m.freezeHistory.push({
    startDate: freeze.startDate,
    plannedEndDate: freeze.endDate,
    resumedAt: at,
    days: freeze.days,
    daysFrozen,
    reason: freeze.reason,
    endedHow,
    createdBy: freeze.createdBy,
    endedBy: staff?.id,
  });
  m.frozenDays = (m.frozenDays || 0) + daysFrozen;
  m.freeze = undefined;
  if (m.status === 'paused') m.status = m.endDate > now ? 'active' : 'expired';
  await m.save({ session });
  await shiftQueuedPlans({ memberId: m.memberId, excludeId: m._id, days: -unusedDays }, session);

  const event = await recordPlanHistory(
    {
      memberId: m.memberId,
      membershipId: m._id,
      toPlanId: m.planId,
      changeType: 'unfreeze',
      days: daysFrozen,
      effectiveFrom: freeze.startDate,
      effectiveTo: at,
      notes: endedHow === 'cancelled' ? 'Freeze removed before it started' : endedHow === 'scheduled' ? 'Freeze ended as planned' : '',
      source: how === 'scheduled' ? 'system' : 'desk',
      createdBy: staff?.id,
      idempotencyKey,
    },
    session
  );
  return { membership: m, event, daysFrozen, unusedDays, endedHow, freezeId: freeze._id };
}

/** Add complimentary days to the current plan (moves any queued renewal too). */
export async function extendMembership({ membershipId, days, reason, staff, idempotencyKey }, session) {
  const m = await loadMembership(membershipId, session);
  if (!CURRENT_STATUSES.includes(m.status)) {
    throw new AppError('Only a current plan can be extended', 409, 'NOT_EXTENDABLE');
  }
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < EXTEND_POLICY.minDays || n > EXTEND_POLICY.maxDays) {
    throw new AppError(`Add ${EXTEND_POLICY.minDays} to ${EXTEND_POLICY.maxDays} days`, 422, 'VALIDATION_ERROR', {
      fields: { days: `Enter ${EXTEND_POLICY.minDays} to ${EXTEND_POLICY.maxDays} days` },
    });
  }
  const previousEnd = m.endDate;
  m.endDate = addDays(m.endDate, n);
  m.bonusDays = (m.bonusDays || 0) + n;
  await m.save({ session });
  await shiftQueuedPlans({ memberId: m.memberId, excludeId: m._id, days: n }, session);

  const event = await recordPlanHistory(
    {
      memberId: m.memberId,
      membershipId: m._id,
      toPlanId: m.planId,
      changeType: 'extend',
      days: n,
      effectiveFrom: previousEnd,
      effectiveTo: m.endDate,
      notes: reason,
      createdBy: staff?.id,
      idempotencyKey,
    },
    session
  );
  return { membership: m, event };
}

/**
 * Cancel a plan. A plan that hasn't started (pending, upcoming) is closed with zero length so it
 * never counts as having run, and its unpaid dues are closed; a running one ends now.
 */
export async function cancelMembershipRecord({ membershipId, memberId, staff, reason, source = 'desk', now = new Date() }, session) {
  const m = await Membership.findOne({ _id: membershipId, ...(memberId && { memberId }) }).session(session);
  if (!m) throw new AppError('Membership not found', 404, 'NOT_FOUND');
  if (![...CURRENT_STATUSES, ...WAITING_STATUSES].includes(m.status)) {
    throw new AppError('Only a current or upcoming plan can be cancelled', 409, 'NOT_CANCELLABLE');
  }
  const started = CURRENT_STATUSES.includes(m.status);
  if (started) {
    if (m.endDate > now) m.endDate = now;
  } else {
    // Never ran: zero length, so it doesn't look like a lapsed plan later.
    const at = m.startDate < now ? m.startDate : now;
    m.startDate = at;
    m.endDate = at;
  }
  m.status = 'cancelled';
  m.freeze = undefined;
  m.cancelledAt = now;
  m.cancelledBy = staff?.id;
  await m.save({ session });
  if (!started) {
    // Nothing was used, so nothing is owed for it. Dues for a plan that ran stay for the desk to decide.
    const note = source === 'self' ? 'Withdrawn by the member' : 'Plan cancelled before it started';
    await Payment.updateMany({ membershipId: m._id, status: 'pending' }, { $set: { status: 'failed', note } }, { session });
  }
  await recordPlanHistory(
    { memberId: m.memberId, membershipId: m._id, toPlanId: m.planId, changeType: 'cancel', notes: reason || '', source, createdBy: staff?.id, effectiveTo: now },
    session
  );
  return m;
}

/**
 * Start freezes whose day has come and resume freezes that have run their course.
 * Idempotent and safe to run concurrently: it runs from the daily roll-over and lazily whenever a
 * member's standing is read. `onResumed` is called once per resumed plan (outside the transaction).
 * @returns {{ paused: number, resumed: number }}
 */
export async function settleFreezes({ memberId, now = new Date(), onResumed = notifyResumed } = {}) {
  const scope = memberId ? { memberId } : {};
  const paused = await Membership.updateMany(
    { ...scope, status: 'active', 'freeze.startDate': { $lte: now }, 'freeze.endDate': { $gt: now } },
    { $set: { status: 'paused' } }
  );

  const due = await Membership.find({ ...scope, status: { $in: CURRENT_STATUSES }, 'freeze.endDate': { $lte: now } })
    .select('_id freeze._id')
    .lean();
  let resumed = 0;
  for (const d of due) {
    try {
      const result = await withTransaction((session) =>
        unfreezeMembership({ membershipId: d._id, freezeId: d.freeze._id, how: 'scheduled', now }, session)
      );
      resumed += 1;
      if (onResumed) Promise.resolve(onResumed(result)).catch((e) => logger.warn(`resume notice failed: ${e.message}`));
    } catch (e) {
      if (e?.code !== 'NOT_FROZEN') throw e; // someone else resumed it first
    }
  }
  return { paused: paused.modifiedCount, resumed };
}

// Imported lazily to keep this module free of notification/email wiring at load time.
async function notifyResumed(result) {
  const { notifyMembershipChange } = await import('./membershipNotices.js');
  await notifyMembershipChange('resumed', result);
}

// ── Timeline ────────────────────────────────────────────────────────────────

const byTime = (a, b) => new Date(b.at) - new Date(a.at);
const SALE_TYPES = ['join', 'renew', 'upgrade', 'downgrade'];

/**
 * Merge plan-history events and memberships into one newest-first timeline. Pure.
 *   includeMoney: false drops amounts (trainers)
 *   includeNotes: false drops staff-only reasons (member app)
 * Plans that simply ran out have no history row, so an "ended" event is added for them.
 *
 * @param {{ history: object[], memberships: object[], users?: Map<string,string>, planNames?: Map<string,string>, includeMoney?: boolean, includeNotes?: boolean, now?: Date }} input
 */
export function buildTimeline({ history, memberships, users = new Map(), planNames = new Map(), includeMoney = true, includeNotes = true, now = new Date() }) {
  const byId = new Map(memberships.map((m) => [String(m._id), m]));
  const events = history.map((h) => {
    const m = h.membershipId ? byId.get(String(h.membershipId)) : null;
    const isSale = SALE_TYPES.includes(h.changeType);
    // Older rows have no source/createdBy: fall back to how the plan itself was sold.
    const source = h.source || (m?.source === 'self' ? 'self' : 'desk');
    const actorId = h.createdBy || (isSale ? m?.createdBy : null);
    const amount = h.amount ?? (isSale ? m?.price : undefined);
    return {
      id: String(h._id),
      type: h.changeType,
      at: h.changedAt || h.createdAt,
      membershipId: h.membershipId ? String(h.membershipId) : null,
      planName: m?.planName || planNames.get(String(h.toPlanId)) || '',
      fromPlanName: h.fromPlanId ? planNames.get(String(h.fromPlanId)) || '' : '',
      days: h.days ?? null,
      from: h.effectiveFrom || (isSale ? m?.startDate : null) || null,
      to: h.effectiveTo || (isSale ? m?.endDate : null) || null,
      status: m?.status || null,
      source,
      by: source === 'self' ? 'Member (online)' : source === 'system' ? 'Automatic' : (actorId && users.get(String(actorId))) || null,
      ...(includeMoney && amount != null && { amount }),
      ...(includeNotes && h.notes && { note: h.notes }),
    };
  });

  for (const m of memberships) {
    if (m.status === 'expired' && new Date(m.endDate) <= now) {
      events.push({
        id: `ended-${m._id}`,
        type: 'ended',
        at: m.endDate,
        membershipId: String(m._id),
        planName: m.planName || '',
        fromPlanName: '',
        days: null,
        from: m.startDate,
        to: m.endDate,
        status: m.status,
        source: 'system',
        by: null,
      });
    }
  }
  return events.sort(byTime);
}

/**
 * The member-facing view of one membership (member app, card, renewals). Pure.
 * `includePrice` false hides the price (e.g. on a printed card).
 */
export function membershipView(m, { now = new Date(), includePrice = true } = {}) {
  if (!m) return null;
  const totalDays = Math.max(1, gymDaysBetween(m.startDate, m.endDate));
  return {
    id: String(m._id),
    planId: m.planId ? String(m.planId?._id || m.planId) : null,
    planName: m.planName || m.planId?.name || '',
    status: m.status,
    source: m.source,
    startDate: m.startDate,
    endDate: m.endDate,
    totalDays,
    daysLeft: ['active', 'paused', 'upcoming'].includes(m.status) ? Math.max(0, daysLeft(m.endDate, now)) : null,
    freeze: m.freeze ? { startDate: m.freeze.startDate, resumeDate: m.freeze.endDate, days: m.freeze.days, running: m.status === 'paused' } : null,
    frozenDays: m.frozenDays || 0,
    bonusDays: m.bonusDays || 0,
    ...(includePrice && { price: m.price ?? null }),
  };
}
