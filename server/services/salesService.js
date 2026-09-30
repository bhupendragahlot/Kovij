import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { AppError } from '../middleware/errorHandler.js';
import { addDays, getPlanOrThrow, planSnapshot, recordPlanHistory } from './membershipService.js';
import { createPayment } from './paymentService.js';
import { findPossibleDuplicates, nextMemberCode, upsertProfile } from './memberService.js';

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
  const history = await Membership.find({ memberId }).select('status endDate planId price').session(session).lean();

  if (history.some((m) => m.status === 'upcoming' || m.status === 'pending')) {
    throw new AppError(
      'This member already has a plan waiting to start. Collect or cancel it first.',
      409,
      'RENEWAL_EXISTS'
    );
  }

  const active = history.find((m) => m.status === 'active');
  let startDate = now;
  if (active && start !== 'today') {
    startDate = active.endDate > now ? active.endDate : now;
  }
  if (active && start === 'today') {
    // Switching plans now: the current plan ends today.
    await Membership.updateOne({ _id: active._id }, { $set: { status: 'expired', endDate: now } }, { session });
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
  let changeType = 'renew';
  if (isFirstPlan) changeType = 'join';
  else if (active && start === 'today') changeType = snapshot.price >= (active.price || 0) ? 'upgrade' : 'downgrade';
  await recordPlanHistory(
    { memberId, membershipId: membership._id, fromPlanId: active?.planId, toPlanId: plan._id, changeType },
    session
  );

  const paidNow = payment?.collect === 'now';
  const base = {
    memberId,
    membershipId: membership._id,
    status: paidNow ? 'paid' : 'pending',
    mode: paidNow ? payment.mode : undefined,
    txnRef: payment?.txnRef || '',
    recordedBy: staff.id,
  };
  const opts = { session, invoicePrefix: settings.invoicePrefix };
  const payments = [];

  const registrationFee = Number(settings.registrationFee) || 0;
  const chargeRegistrationNow = chargeRegistration === 'auto' ? isFirstPlan : Boolean(chargeRegistration);
  if (chargeRegistrationNow && registrationFee > 0) {
    payments.push(
      await createPayment(
        { ...base, type: 'registration', amount: registrationFee, idempotencyKey: idempotencyKey && `${idempotencyKey}:registration` },
        opts
      )
    );
  }
  if (snapshot.price > 0) {
    payments.push(
      await createPayment(
        {
          ...base,
          type: isFirstPlan ? 'membership' : 'renewal',
          amount: snapshot.price,
          idempotencyKey: idempotencyKey && `${idempotencyKey}:plan`,
        },
        opts
      )
    );
  }

  return { membership, payments, plan, changeType };
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
