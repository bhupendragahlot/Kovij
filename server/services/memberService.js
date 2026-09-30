import Member from '../models/Member.js';
import MemberProfile from '../models/MemberProfile.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';
import { nextSequence } from '../models/Counter.js';
import { canonicalPhone, escapeRegex, normalizePhone } from '../utils/strings.js';
import { dayjs } from '../utils/time.js';
import { toObjectId } from '../utils/db.js';

export const MEMBER_STATES = ['active', 'expiring', 'upcoming', 'pending', 'expired', 'none'];

export async function nextMemberCode(prefix, session) {
  const seq = await nextSequence('member', session);
  return `${prefix || 'KFZ'}-${String(seq).padStart(4, '0')}`;
}

/** Members that look like the same person (same canonical phone or same email). */
export async function findPossibleDuplicates({ phone, email, excludeId }) {
  const or = [];
  const canonical = canonicalPhone(phone);
  if (canonical && canonical.replace(/\D/g, '').length >= 10) or.push({ phone: canonical });
  if (email) or.push({ email: String(email).toLowerCase().trim() });
  if (!or.length) return [];
  const filter = { $or: or };
  if (excludeId) filter._id = { $ne: excludeId };
  return Member.find(filter).select('name phone email memberCode profilePhoto').limit(5).lean();
}

/** Free-text member search across name, phone, email and member code. */
export function memberSearchFilter(q) {
  const term = String(q || '').trim();
  if (!term) return {};
  const rx = new RegExp(escapeRegex(term), 'i');
  const digits = normalizePhone(term);
  const or = [{ name: rx }, { email: rx }, { memberCode: rx }];
  if (digits.length >= 3) or.push({ phone: new RegExp(escapeRegex(digits)) });
  return { $or: or };
}

/**
 * Aggregation stages that attach each member's current standing:
 *   state: active | expiring | upcoming | pending | expired | none
 *   current: the active (or otherwise most relevant) membership
 *   dues: total pending amount
 */
function standingStages(now, expiringUntil) {
  const pick = (status) => ({ $first: { $filter: { input: '$ms', cond: { $eq: ['$$this.status', status] } } } });
  const has = (field) => ({ $ne: [{ $type: field }, 'missing'] });
  return [
    {
      $lookup: {
        from: 'memberships',
        localField: '_id',
        foreignField: 'memberId',
        as: 'ms',
        pipeline: [
          { $sort: { endDate: -1 } },
          { $project: { status: 1, startDate: 1, endDate: 1, planName: 1, planId: 1 } },
        ],
      },
    },
    {
      $lookup: {
        from: 'payments',
        localField: '_id',
        foreignField: 'memberId',
        as: 'dueRows',
        pipeline: [{ $match: { status: 'pending' } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }],
      },
    },
    {
      $addFields: {
        _active: pick('active'),
        _pending: pick('pending'),
        _upcoming: pick('upcoming'),
        _ended: { $first: { $filter: { input: '$ms', cond: { $in: ['$$this.status', ['expired', 'cancelled']] } } } },
        dues: { $ifNull: [{ $first: '$dueRows.amount' }, 0] },
      },
    },
    {
      $addFields: {
        state: {
          $switch: {
            branches: [
              { case: { $and: [has('$_active'), { $lte: ['$_active.endDate', expiringUntil] }] }, then: 'expiring' },
              { case: has('$_active'), then: 'active' },
              { case: has('$_pending'), then: 'pending' },
              { case: has('$_upcoming'), then: 'upcoming' },
              { case: has('$_ended'), then: 'expired' },
            ],
            default: 'none',
          },
        },
        current: { $ifNull: ['$_active', { $ifNull: ['$_pending', { $ifNull: ['$_upcoming', '$_ended'] }] }] },
      },
    },
    { $project: { ms: 0, dueRows: 0, _active: 0, _pending: 0, _upcoming: 0, _ended: 0 } },
  ];
}

const SORTS = {
  recent: { createdAt: -1 },
  name: { name: 1 },
  ending: { 'current.endDate': 1, name: 1 },
};

/**
 * Paginated member list with standing, dues and per-state counts for filter chips.
 */
export async function listMembersWithStanding({ q, state, page = 1, limit = 25, sort = 'recent', expiringWindowDays = 7 }) {
  const now = new Date();
  const expiringUntil = dayjs(now).add(expiringWindowDays, 'day').toDate();
  const stateMatch = state === 'dues' ? { dues: { $gt: 0 } } : state && state !== 'all' ? { state } : {};
  const sortStage = SORTS[sort] || (state === 'expiring' ? SORTS.ending : SORTS.recent);

  const [result] = await Member.aggregate([
    { $match: memberSearchFilter(q) },
    ...standingStages(now, expiringUntil),
    {
      $facet: {
        rows: [
          { $match: stateMatch },
          { $sort: sortStage },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              name: 1, phone: 1, email: 1, memberCode: 1, profilePhoto: 1, createdAt: 1, source: 1,
              state: 1, dues: 1, current: 1,
            },
          },
        ],
        total: [{ $match: stateMatch }, { $count: 'n' }],
        counts: [
          { $group: { _id: '$state', n: { $sum: 1 } } },
        ],
        dueCount: [{ $match: { dues: { $gt: 0 } } }, { $count: 'n' }],
      },
    },
  ]);

  const counts = Object.fromEntries(MEMBER_STATES.map((s) => [s, 0]));
  for (const c of result.counts) counts[c._id] = c.n;
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0);
  counts.dues = result.dueCount[0]?.n || 0;

  return {
    members: result.rows,
    total: result.total[0]?.n || 0,
    page,
    limit,
    counts,
  };
}

/** Everything the member profile screen needs, in one round trip. */
export async function getMemberDetail(memberId, { expiringWindowDays = 7 } = {}) {
  const id = toObjectId(memberId);
  const now = new Date();
  const expiringUntil = dayjs(now).add(expiringWindowDays, 'day').toDate();
  const since30 = dayjs(now).subtract(30, 'day').toDate();

  const [standing] = await Member.aggregate([{ $match: { _id: id } }, ...standingStages(now, expiringUntil)]);
  if (!standing) return null;

  const [profile, memberships, payments, visits30, lastVisit, totalVisits] = await Promise.all([
    MemberProfile.findOne({ memberId: id }).lean(),
    Membership.find({ memberId: id }).sort({ startDate: -1 }).limit(50).lean(),
    Payment.find({ memberId: id }).sort({ createdAt: -1 }).limit(100).lean(),
    Attendance.countDocuments({ memberId: id, checkedInAt: { $gte: since30 } }),
    Attendance.findOne({ memberId: id }).sort({ checkedInAt: -1 }).lean(),
    Attendance.countDocuments({ memberId: id }),
  ]);

  return {
    member: standing,
    profile,
    memberships,
    payments,
    attendance: {
      last30Days: visits30,
      total: totalVisits,
      lastCheckInAt: lastVisit?.checkedInAt || null,
    },
  };
}

export async function upsertProfile(memberId, health, session) {
  if (!health) return;
  const patch = {};
  const fields = ['heightCm', 'weightKg', 'bloodGroup', 'injuries', 'allergies'];
  for (const f of fields) if (health[f] !== undefined) patch[f] = health[f];
  if (health.medicalDetails !== undefined || health.medicalHas !== undefined) {
    patch.medicalCondition = { has: Boolean(health.medicalHas), details: health.medicalDetails || '' };
  }
  if (health.goalKind) patch.fitnessGoal = { goalKind: health.goalKind, customText: health.goalCustomText || '' };
  if (patch.heightCm && patch.weightKg) {
    const h = patch.heightCm / 100;
    patch.bmi = Math.round((patch.weightKg / (h * h)) * 10) / 10;
  }
  if (!Object.keys(patch).length) return;
  await MemberProfile.findOneAndUpdate({ memberId }, { $set: { memberId, ...patch } }, { upsert: true, session });
}
