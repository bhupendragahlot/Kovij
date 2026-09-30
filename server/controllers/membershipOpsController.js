import Membership from '../models/Membership.js';
import PlanHistory from '../models/PlanHistory.js';
import { can } from '../config/permissions.js';
import {
  extendMembership,
  freezeMembership,
  settleFreezes,
  settleFreezesSoon,
  unfreezeMembership,
} from '../services/membershipService.js';
import { notifyMembershipChange } from '../services/membershipNotices.js';
import { listEnding, listLapsed, listRenewalHistory } from '../services/renewalService.js';
import { withTransaction } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const staffActor = (req) => ({ id: req.staffUser.id, role: req.staffUser.role });

/** Tell the member after the change is committed; a failed notice never undoes the change. */
function notifyAfter(kind, result, req) {
  notifyMembershipChange(kind, result, { staffId: req.staffUser.id }).catch((e) =>
    logger.warn(`membership ${kind} notice failed for ${result.membership._id}: ${e.message}`)
  );
}

/** A retried request whose first attempt already committed (the idempotency record was lost). */
async function replayed(req) {
  if (!req.idempotencyKey) return null;
  const event = await PlanHistory.findOne({ idempotencyKey: req.idempotencyKey }).lean();
  if (!event) return null;
  const membership = await Membership.findById(event.membershipId).lean();
  return { success: true, replayed: true, membership, event };
}

const view = (m) => (typeof m.toObject === 'function' ? m.toObject() : m);

/** POST /api/admin/memberships/:id/freeze { startDate?, days, reason } */
export const freeze = asyncHandler(async (req, res) => {
  const again = await replayed(req);
  if (again) return res.json(again);
  const { startDate, days, reason } = req.validated.body;
  const result = await withTransaction((session) =>
    freezeMembership({ membershipId: req.params.id, startDay: startDate, days, reason, staff: staffActor(req), idempotencyKey: req.idempotencyKey }, session)
  );
  notifyAfter('frozen', result, req);
  res.status(201).json({ success: true, membership: view(result.membership), event: result.event });
});

/** POST /api/admin/memberships/:id/unfreeze — early resume, or remove a freeze that hasn't started. */
export const unfreeze = asyncHandler(async (req, res) => {
  const again = await replayed(req);
  if (again) return res.json(again);
  const result = await withTransaction((session) =>
    unfreezeMembership({ membershipId: req.params.id, how: 'manual', staff: staffActor(req), idempotencyKey: req.idempotencyKey }, session)
  );
  notifyAfter('unfrozen', result, req);
  res.json({
    success: true,
    membership: view(result.membership),
    event: result.event,
    daysFrozen: result.daysFrozen,
    daysGivenBack: result.unusedDays,
    endedHow: result.endedHow,
  });
});

/** POST /api/admin/memberships/:id/extend { days, reason } — complimentary days. */
export const extend = asyncHandler(async (req, res) => {
  const again = await replayed(req);
  if (again) return res.json(again);
  const { days, reason } = req.validated.body;
  const result = await withTransaction((session) =>
    extendMembership({ membershipId: req.params.id, days, reason, staff: staffActor(req), idempotencyKey: req.idempotencyKey }, session)
  );
  notifyAfter('extended', result, req);
  res.status(201).json({ success: true, membership: view(result.membership), event: result.event });
});

/** Amounts are for roles that may see money; the desk list still works without them. */
function stripMoney(req, result) {
  if (can(req.staffUser.role, 'payments.view')) return result;
  return {
    ...result,
    items: result.items.map(({ dues, amount, ...item }) => ({
      ...item,
      ...(item.membership && { membership: { ...item.membership, price: undefined } }),
    })),
  };
}

/** GET /api/admin/memberships/ending?within=7|15|30 */
export const ending = asyncHandler(async (req, res) => {
  await settleFreezesSoon();
  res.json({ success: true, ...stripMoney(req, await listEnding(req.validated.query)) });
});

/** GET /api/admin/memberships/lapsed?since=60 */
export const lapsed = asyncHandler(async (req, res) => {
  res.json({ success: true, ...stripMoney(req, await listLapsed(req.validated.query)) });
});

/** GET /api/admin/memberships/renewal-history?since=30&type=all */
export const renewalHistory = asyncHandler(async (req, res) => {
  res.json({ success: true, ...stripMoney(req, await listRenewalHistory(req.validated.query)) });
});

/** POST /api/admin/memberships/_test/settle { now } — test-only clock for the freeze roll-over. */
export const settleForTest = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV !== 'test') throw new AppError('Not found', 404, 'NOT_FOUND');
  const result = await settleFreezes({ now: req.validated.body.now });
  res.json({ success: true, ...result });
});
