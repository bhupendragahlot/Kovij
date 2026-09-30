import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  CURRENT_STATUSES,
  WAITING_STATUSES,
  addDays,
  getPlanOrThrow,
  hasRun,
  planSnapshot,
  recordPlanHistory,
  saleChangeType,
} from './membershipService.js';
import { createPayment } from './paymentService.js';
import { findPossibleDuplicates, joinedAtFromDay, nextMemberCode, resolveReferral, upsertProfile } from './memberService.js';

/** Plans that count as the member's history (a request withdrawn before it started doesn't). */
const countsAsHistory = (m) => m.status !== 'cancelled' || hasRun(m);

/** Registration fee + plan price as dues or paid payments, all created through createPayment. */
async function createSalePayments({ memberId, membershipId, isFirstPlan, chargeRegistration = isFirstPlan, price, settings, base, idempotencyKey }, session) {
  const opts = { session, invoicePrefix: settings.invoicePrefix };
  const payments = [];
  const registrationFee = Number(settings.registrationFee) || 0;
  if (chargeRegistration && registrationFee > 0) {
    payments.push(
      await createPayment(
        { memberId, membershipId, ...base, type: 'registration', amount: registrationFee, idempotencyKey: idempotencyKey && `${idempotencyKey}:registration` },
        opts
      )
    );
  }
  if (price > 0) {
    payments.push(
      await createPayment(
        { memberId, membershipId, ...base, type: isFirstPlan ? 'membership' : 'renewal', amount: price, idempotencyKey: idempotencyKey && `${idempotencyKey}:plan` },
        opts
      )
    );
  }
  return payments;
}

/**
 * Sell a plan to an existing member at the desk: new join, renewal, or plan switch.
 *
 * @param {object} input
 * @param {'auto'|'today'|'after_current'} input.start  auto = continue after the current plan, if any
 * @param {{collect:'now'|'later', mode?:string, txnRef?:string}} input.payment
 * @param {'auto'|boolean} input.chargeRegistration      auto = only on a member's first plan
 */
export async function sellMembership(
  { memberId, planId, start = 'auto', priceOverride, payment, chargeRegistration = 'auto', staff, settings, idempotencyKey },
  session
) {
  const plan = await getPlanOrThrow(planId, session);
  const now = new Date();
  const all = await Membership.find({ memberId }).select('status startDate endDate planId price freeze').sort({ endDate: -1 }).session(session).lean();
  const history = all.filter(countsAsHistory);

  if (history.some((m) => WAITING_STATUSES.includes(m.status))) {
    throw new AppError(
      'This member already has a plan waiting to start. Collect or cancel it first.',
      409,
      'RENEWAL_EXISTS'
    );
  }

  const current = history.find((m) => CURRENT_STATUSES.includes(m.status));
  if (current && start === 'today' && current.freeze) {
    throw new AppError('The current plan has a freeze. Unfreeze it before switching plans today.', 409, 'PLAN_FROZEN');
  }
  let startDate = now;
  if (current && start !== 'today') {
    startDate = current.endDate > now ? current.endDate : now;
  }
  if (current && start === 'today') {
    // Switching plans now: the current plan ends today.
    await Membership.updateOne({ _id: current._id }, { $set: { status: 'expired', endDate: now } }, { session });
  }

  const snapshot = planSnapshot(plan, priceOverride);
  const [membership] = await Membership.create(
    [
      {
        memberId,
        ...snapshot,
        startDate,
        endDate: addDays(startDate, snapshot.durationDays),
        status: startDate > now ? 'upcoming' : 'active',
        source: 'desk',
        createdBy: staff.id,
      },
    ],
    { session }
  );

  const isFirstPlan = history.length === 0;
  const changeType = saleChangeType({ isFirstPlan, previous: current || history[0], planId: plan._id, price: snapshot.price });
  await recordPlanHistory(
    {
      memberId,
      membershipId: membership._id,
      fromPlanId: (current || history[0])?.planId,
      toPlanId: plan._id,
      changeType,
      amount: snapshot.price,
      effectiveFrom: membership.startDate,
      effectiveTo: membership.endDate,
      createdBy: staff.id,
    },
    session
  );

  const paidNow = payment?.collect === 'now';
  const base = {
    status: paidNow ? 'paid' : 'pending',
    mode: paidNow ? payment.mode : undefined,
    txnRef: payment?.txnRef || '',
    recordedBy: staff.id,
  };
  const payments = await createSalePayments(
    {
      memberId,
      membershipId: membership._id,
      isFirstPlan,
      chargeRegistration: chargeRegistration === 'auto' ? isFirstPlan : Boolean(chargeRegistration),
      price: snapshot.price,
      settings,
      base,
      idempotencyKey,
    },
    session
  );

  return { membership, payments, plan, changeType };
}

/**
 * A member asks for a plan from the app or website (first join, renewal or plan change).
 * Creates a `pending` membership and pending dues priced by the server. Nothing changes for the
 * member until the dues are paid (desk or online); the plan then starts after the current one.
 */
export async function requestMembership({ memberId, plan, settings, idempotencyKey, changeType: requested }, session) {
  const all = await Membership.find({ memberId }).select('status startDate endDate planId price').sort({ endDate: -1 }).session(session).lean();
  const history = all.filter(countsAsHistory);
  if (history.some((m) => m.status === 'pending')) {
    throw new AppError('Your earlier request is waiting for payment. Pay it or withdraw it first.', 409, 'PENDING_PAYMENT');
  }
  if (history.some((m) => m.status === 'upcoming')) {
    throw new AppError('You already have a plan waiting to start', 409, 'RENEWAL_EXISTS');
  }

  const isFirstPlan = history.length === 0;
  const current = history.find((m) => CURRENT_STATUSES.includes(m.status));
  const snapshot = planSnapshot(plan);
  const now = new Date();
  const [membership] = await Membership.create(
    [
      {
        memberId,
        ...snapshot,
        // Placeholder dates: the real start is set when the dues are paid (activateIfSettled).
        startDate: now,
        endDate: addDays(now, snapshot.durationDays),
        status: 'pending',
        source: 'self',
      },
    ],
    { session }
  );
  const previous = current || history[0];
  const changeType = isFirstPlan ? 'join' : requested || saleChangeType({ isFirstPlan, previous, planId: plan._id, price: snapshot.price });
  await recordPlanHistory(
    { memberId, membershipId: membership._id, fromPlanId: previous?.planId, toPlanId: plan._id, changeType, amount: snapshot.price, source: 'self' },
    session
  );

  const dues = await createSalePayments(
    { memberId, membershipId: membership._id, isFirstPlan, price: snapshot.price, settings, base: { status: 'pending' }, idempotencyKey },
    session
  );
  return {
    membership,
    dues,
    changeType,
    amountDue: dues.reduce((sum, p) => sum + p.amount, 0),
    startsAfter: current && current.endDate > now ? current.endDate : null,
  };
}

/**
 * Register a member at the desk (walk-in or converted lead), optionally selling a first plan.
 * Duplicate phone/email matches block creation unless `force` is set, so the desk
 * opens the existing profile instead of creating a second one.
 */
export async function registerDeskMember({ details, health, membership, force, staff, settings, source = 'desk', idempotencyKey }, session) {
  if (!force) {
    const matches = await findPossibleDuplicates({ phone: details.phone, email: details.email });
    if (matches.length) {
      throw new AppError('A member with this phone or email already exists', 409, 'DUPLICATE_MEMBER', {
        matches: matches.map((m) => ({ id: String(m._id), name: m.name, phone: m.phone, email: m.email, memberCode: m.memberCode })),
      });
    }
  }

  const referral = await resolveReferral(details.referral, { session });
  const memberCode = await nextMemberCode(settings.invoicePrefix, session);
  const [member] = await Member.create(
    [
      {
        name: details.name,
        phone: details.phone,
        email: details.email,
        gender: details.gender,
        dob: details.dob,
        address: details.address,
        emergencyContact: details.emergencyContact,
        notes: details.notes || '',
        joinedAt: joinedAtFromDay(details.joinedAt),
        ...(referral && { referral }),
        memberCode,
        source,
        createdBy: staff.id,
      },
    ],
    { session }
  );

  await upsertProfile(member._id, health, session);

  let sale = null;
  if (membership?.planId) {
    sale = await sellMembership(
      { memberId: member._id, ...membership, staff, settings, idempotencyKey },
      session
    );
  }
  return { member, sale };
}
