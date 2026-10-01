import ActivityLog from '../models/ActivityLog.js';
import LoginEvent from '../models/LoginEvent.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseGymDay } from '../utils/time.js';
import { describeActivity, deviceLabel } from '../services/activityService.js';

/** `from`/`to` are gym days (YYYY-MM-DD), both inclusive. */
function dayRange(from, to) {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = parseGymDay(from).toDate();
  if (to) range.$lt = parseGymDay(to).add(1, 'day').toDate();
  return range;
}

async function staffOptions() {
  const users = await User.find().select('name username role isActive').sort({ name: 1 }).lean();
  return users.map((u) => ({ id: String(u._id), name: u.name || u.username, role: u.role, isActive: u.isActive !== false }));
}

/** GET /api/admin/activity */
export const listActivity = asyncHandler(async (req, res) => {
  const { actorId, memberId, kind, entityType, from, to, outcome, page, limit } = req.validated.query;
  const filter = {};
  if (actorId) filter['actor.id'] = actorId;
  if (memberId) filter.memberId = memberId;
  if (kind) filter.kind = kind;
  if (entityType) filter.entityType = entityType;
  if (outcome === 'ok') filter.ok = true;
  if (outcome === 'failed') filter.ok = false;
  const at = dayRange(from, to);
  if (at) filter.at = at;

  const [rows, total, staff] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('memberId', 'name memberCode')
      .lean(),
    ActivityLog.countDocuments(filter),
    page === 1 ? staffOptions() : undefined,
  ]);

  const items = rows.map((r) => ({
    id: String(r._id),
    at: r.at,
    actor: { id: r.actor?.id ? String(r.actor.id) : null, name: r.actor?.name || 'Someone', role: r.actor?.role || '' },
    action: r.action,
    kind: r.kind,
    entityType: r.entityType,
    summary: describeActivity(r, { memberName: r.memberId?.name }),
    member: r.memberId?._id ? { id: String(r.memberId._id), name: r.memberId.name, memberCode: r.memberId.memberCode || '' } : null,
    amount: r.amount ?? null,
    ok: r.ok !== false,
    status: r.status,
    ip: r.ip || '',
    device: deviceLabel(r.userAgent),
  }));
  res.json({ success: true, items, total, page, limit, ...(staff && { staff }) });
});

const REASON = {
  ok: 'Signed in',
  wrong_password: 'Wrong password',
  unknown_account: 'No account with this email',
  inactive: 'Account deactivated',
  locked: 'Paused after too many wrong passwords',
  password_reset: 'Set a new password with a reset link',
};

/** GET /api/admin/activity/sign-ins */
export const listSignIns = asyncHandler(async (req, res) => {
  const { userId, outcome, from, to, page, limit } = req.validated.query;
  const filter = {};
  if (userId) filter.userId = userId;
  if (outcome === 'ok') filter.success = true;
  if (outcome === 'failed') filter.success = false;
  const at = dayRange(from, to);
  if (at) filter.at = at;

  const [rows, total, failedLast24h] = await Promise.all([
    LoginEvent.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'name username role').lean(),
    LoginEvent.countDocuments(filter),
    LoginEvent.countDocuments({ success: false, at: { $gte: new Date(Date.now() - 86_400_000) } }),
  ]);

  const items = rows.map((e) => ({
    id: String(e._id),
    at: e.at,
    email: e.email,
    user: e.userId?._id ? { id: String(e.userId._id), name: e.userId.name || e.userId.username, role: e.userId.role } : null,
    success: e.success,
    reason: e.reason,
    reasonLabel: REASON[e.reason] || (e.success ? 'Signed in' : 'Failed'),
    ip: e.ip || '',
    device: deviceLabel(e.userAgent),
  }));
  res.json({ success: true, items, total, page, limit, failedLast24h });
});
