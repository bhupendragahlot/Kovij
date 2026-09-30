import Member from '../models/Member.js';
import MemberProfile from '../models/MemberProfile.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';
import Trainer from '../models/Trainer.js';
import { nextSequence } from '../models/Counter.js';
import { AppError } from '../middleware/errorHandler.js';
import { canonicalPhone, escapeRegex, normalizePhone } from '../utils/strings.js';
import { dayjs, gymDayKey, parseGymDay, toGymTime } from '../utils/time.js';
import { toObjectId } from '../utils/db.js';
import { settleFreezes, settleFreezesSoon } from './membershipService.js';
import { logger } from '../utils/logger.js';

export const MEMBER_STATES = ['active', 'expiring', 'paused', 'upcoming', 'pending', 'expired', 'none'];
export const REFERRAL_CHANNELS = ['friend', 'instagram', 'google', 'walk_in', 'website', 'other'];

export async function nextMemberCode(prefix, session) {
  const seq = await nextSequence('member', session);
  return `${prefix || 'KFZ'}-${String(seq).padStart(4, '0')}`;
}

/** `YYYY-MM-DD` (gym day) → the start of that day; today when not given. */
export function joinedAtFromDay(dayKey, now = new Date()) {
  return parseGymDay(dayKey || gymDayKey(now)).toDate();
}

/**
 * Validate and normalise a referral from a form: the referring member must exist, and their name
 * is kept as a snapshot so the profile still reads well if they are later removed.
 * @returns the referral object to store, or null when nothing was given
 */
export async function resolveReferral(referral, { session, selfId } = {}) {
  if (!referral) return null;
  const { channel, referredByMemberId, referredByName } = referral;
  if (!channel && !referredByMemberId && !referredByName) return null;
  const out = { channel: channel || (referredByMemberId || referredByName ? 'friend' : undefined) };
  if (referredByMemberId) {
    if (selfId && String(selfId) === String(referredByMemberId)) {
      throw new AppError('A member can’t refer themselves', 422, 'VALIDATION_ERROR', { fields: { 'details.referral.referredByMemberId': 'Choose someone else' } });
    }
    const referrer = await Member.findById(referredByMemberId).select('name').session(session ?? null).lean();
    if (!referrer) {
      throw new AppError('The referring member was not found', 422, 'VALIDATION_ERROR', {
        fields: { 'details.referral.referredByMemberId': 'Choose a member from the search results' },
      });
    }
    out.referredByMemberId = referrer._id;
    out.referredByName = referrer.name;
  } else if (referredByName) {
    out.referredByName = referredByName;
  }
  return out;
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
 * Filter for the members list: search text, joined-date range (gym days, inclusive; members without
 * a joining date count from when they were registered), and assigned trainer ('none' = unassigned).
 */
export function memberListFilter({ q, joinedFrom, joinedTo, trainerId } = {}) {
  const and = [];
  const search = memberSearchFilter(q);
  if (search.$or) and.push(search);
  const joined = { $ifNull: ['$joinedAt', '$createdAt'] };
  if (joinedFrom) and.push({ $expr: { $gte: [joined, parseGymDay(joinedFrom).toDate()] } });
  if (joinedTo) and.push({ $expr: { $lt: [joined, parseGymDay(joinedTo).add(1, 'day').toDate()] } });
  if (trainerId === 'none') and.push({ assignedTrainerId: null });
  else if (trainerId) and.push({ assignedTrainerId: toObjectId(trainerId) });
  return and.length ? { $and: and } : {};
}

/**
 * Aggregation stages that attach each member's current standing:
 *   state: active | expiring | paused | upcoming | pending | expired | none
 *   current: the active (or otherwise most relevant) membership
 *   dues: total pending amount
 */
function standingStages(now, expiringUntil) {
  const pick = (status) => ({ $first: { $filter: { input: '$ms', cond: { $eq: ['$$this.status', status] } } } });
  const has = (field) => ({ $ne: [{ $type: field }, 'missing'] });
  // A cancelled request that never started isn't a lapsed plan.
  const ran = { $lt: ['$$this.startDate', '$$this.endDate'] };
  return [
    {
      $lookup: {
        from: 'memberships',
        localField: '_id',
        foreignField: 'memberId',
        as: 'ms',
        pipeline: [
          { $sort: { endDate: -1 } },
          { $project: { status: 1, startDate: 1, endDate: 1, planName: 1, planId: 1, freeze: 1 } },
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
        _paused: pick('paused'),
        _pending: pick('pending'),
        _upcoming: pick('upcoming'),
        _ended: {
          $first: {
            $filter: {
              input: '$ms',
              cond: { $or: [{ $eq: ['$$this.status', 'expired'] }, { $and: [{ $eq: ['$$this.status', 'cancelled'] }, ran] }] },
            },
          },
        },
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
              { case: has('$_paused'), then: 'paused' },
              { case: has('$_pending'), then: 'pending' },
              { case: has('$_upcoming'), then: 'upcoming' },
              { case: has('$_ended'), then: 'expired' },
            ],
            default: 'none',
          },
        },
        current: { $ifNull: ['$_active', { $ifNull: ['$_paused', { $ifNull: ['$_pending', { $ifNull: ['$_upcoming', '$_ended'] }] }] }] },
      },
    },
    { $project: { ms: 0, dueRows: 0, _active: 0, _paused: 0, _pending: 0, _upcoming: 0, _ended: 0 } },
  ];
}

const SORTS = {
  recent: { createdAt: -1 },
  name: { name: 1 },
  ending: { 'current.endDate': 1, name: 1 },
  joined: { joinedOn: -1, _id: -1 },
};

const LIST_FIELDS = {
  name: 1, phone: 1, email: 1, memberCode: 1, profilePhoto: 1, createdAt: 1, joinedAt: 1, joinedOn: 1, source: 1,
  assignedTrainerId: 1, state: 1, dues: 1, current: 1,
};


/**
 * Paginated member list with standing, dues and per-state counts for filter chips.
 */
export async function listMembersWithStanding({ q, state, joinedFrom, joinedTo, trainerId, page = 1, limit = 25, sort = 'recent', expiringWindowDays = 7 }) {
  await settleFreezesSoon();
  const now = new Date();
  const expiringUntil = dayjs(now).add(expiringWindowDays, 'day').toDate();
  const stateMatch = state === 'dues' ? { dues: { $gt: 0 } } : state && state !== 'all' ? { state } : {};
  const sortStage = SORTS[sort] || (state === 'expiring' ? SORTS.ending : SORTS.recent);

  const [result] = await Member.aggregate([
    { $match: memberListFilter({ q, joinedFrom, joinedTo, trainerId }) },
    { $addFields: { joinedOn: { $ifNull: ['$joinedAt', '$createdAt'] } } },
    ...standingStages(now, expiringUntil),
    {
      $facet: {
        rows: [
          { $match: stateMatch },
          { $sort: sortStage },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: LIST_FIELDS },
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

// ── CSV export ──────────────────────────────────────────────────────────────

export const EXPORT_LIMIT = 5000;

const STATE_LABEL = {
  active: 'Active', expiring: 'Ends soon', paused: 'Frozen', upcoming: 'Starts later', pending: 'Awaiting payment', expired: 'Lapsed', none: 'No plan',
};
const REFERRAL_LABEL = { friend: 'Friend or member', instagram: 'Instagram', google: 'Google', walk_in: 'Walk-in', website: 'Website', other: 'Other' };
const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other', prefer_not_say: 'Prefer not to say' };

/**
 * One CSV cell. Quotes when needed, and defuses values a spreadsheet would run as a formula
 * (a name like "=HYPERLINK(...)" typed at the desk must stay text).
 */
export function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  // BOM so Excel opens UTF-8 names (Hindi, ₹) correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

const csvDay = (value) => (value ? toGymTime(value).format('YYYY-MM-DD') : '');

/**
 * The filtered members list as CSV for a spreadsheet. Contact, plan and trainer only: no health
 * data, and dues only when `includeMoney` (roles that may see payments).
 */
export async function exportMembersCsv({ q, state, joinedFrom, joinedTo, trainerId, sort = 'name', expiringWindowDays = 7, includeMoney = false }) {
  await settleFreezesSoon();
  const now = new Date();
  const expiringUntil = dayjs(now).add(expiringWindowDays, 'day').toDate();
  const stateMatch = state === 'dues' ? { dues: { $gt: 0 } } : state && state !== 'all' ? { state } : {};
  const rows = await Member.aggregate([
    { $match: memberListFilter({ q, joinedFrom, joinedTo, trainerId }) },
    { $addFields: { joinedOn: { $ifNull: ['$joinedAt', '$createdAt'] } } },
    ...standingStages(now, expiringUntil),
    { $match: stateMatch },
    { $sort: SORTS[sort] || SORTS.name },
    { $limit: EXPORT_LIMIT + 1 },
    { $lookup: { from: 'trainers', localField: 'assignedTrainerId', foreignField: '_id', as: 'trainer', pipeline: [{ $project: { name: 1 } }] } },
    {
      $project: {
        memberCode: 1, name: 1, phone: 1, email: 1, gender: 1, joinedOn: 1, state: 1, current: 1, dues: 1, referral: 1,
        city: '$address.city', trainerName: { $first: '$trainer.name' },
      },
    },
  ]);
  if (rows.length > EXPORT_LIMIT) {
    throw new AppError(`That's more than ${EXPORT_LIMIT} members. Narrow the filters and export again.`, 422, 'EXPORT_TOO_LARGE');
  }

  const columns = [
    { header: 'Member code', value: (r) => r.memberCode },
    { header: 'Name', value: (r) => r.name },
    { header: 'Mobile', value: (r) => r.phone },
    { header: 'Email', value: (r) => r.email },
    { header: 'Gender', value: (r) => GENDER_LABEL[r.gender] || '' },
    { header: 'City', value: (r) => r.city },
    { header: 'Joined', value: (r) => csvDay(r.joinedOn) },
    { header: 'Status', value: (r) => STATE_LABEL[r.state] || r.state },
    { header: 'Plan', value: (r) => r.current?.planName },
    { header: 'Plan starts', value: (r) => csvDay(r.current?.startDate) },
    { header: 'Plan ends', value: (r) => csvDay(r.current?.endDate) },
    { header: 'Trainer', value: (r) => r.trainerName },
    { header: 'Heard about us', value: (r) => REFERRAL_LABEL[r.referral?.channel] || '' },
    { header: 'Referred by', value: (r) => r.referral?.referredByName },
    ...(includeMoney ? [{ header: 'Dues (INR)', value: (r) => (r.dues > 0 ? r.dues : 0) }] : []),
  ];
  return { csv: toCsv(columns, rows), count: rows.length };
}

// ── Detail ──────────────────────────────────────────────────────────────────

/** Everything the member profile screen needs, in one round trip. */
export async function getMemberDetail(memberId, { expiringWindowDays = 7 } = {}) {
  const id = toObjectId(memberId);
  await settleFreezes({ memberId: id }).catch((e) => logger.warn(`settleFreezes(${memberId}) failed: ${e.message}`));
  const now = new Date();
  const expiringUntil = dayjs(now).add(expiringWindowDays, 'day').toDate();
  const since30 = dayjs(now).subtract(30, 'day').toDate();

  const [standing] = await Member.aggregate([{ $match: { _id: id } }, ...standingStages(now, expiringUntil)]);
  if (!standing) return null;

  const [profile, memberships, payments, visits30, lastVisit, totalVisits, trainer, referrer] = await Promise.all([
    MemberProfile.findOne({ memberId: id }).lean(),
    Membership.find({ memberId: id }).sort({ startDate: -1 }).limit(50).lean(),
    Payment.find({ memberId: id }).sort({ createdAt: -1 }).limit(100).lean(),
    Attendance.countDocuments({ memberId: id, checkedInAt: { $gte: since30 } }),
    Attendance.findOne({ memberId: id }).sort({ checkedInAt: -1 }).lean(),
    Attendance.countDocuments({ memberId: id }),
    standing.assignedTrainerId ? Trainer.findById(standing.assignedTrainerId).select('name role phone image isActive').lean() : null,
    standing.referral?.referredByMemberId ? Member.findById(standing.referral.referredByMemberId).select('name memberCode').lean() : null,
  ]);

  return {
    member: {
      ...standing,
      assignedTrainer: trainer ? { _id: trainer._id, name: trainer.name, role: trainer.role, phone: trainer.phone, image: trainer.image, isActive: trainer.isActive } : null,
      ...(standing.referral && {
        referral: { ...standing.referral, referredBy: referrer ? { _id: referrer._id, name: referrer.name, memberCode: referrer.memberCode } : null },
      }),
    },
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

/**
 * Remove what a role may not see from a member payload: money for roles without payments.view,
 * health for roles without members.health.view. Mutates and returns `detail`.
 */
export function redactMemberDetail(detail, { money, health }) {
  if (!money) {
    detail.payments = [];
    if (detail.member) delete detail.member.dues;
    detail.memberships = (detail.memberships || []).map(({ price, ...m }) => m);
  }
  if (!health) detail.profile = null;
  return detail;
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
