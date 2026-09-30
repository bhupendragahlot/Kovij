/**
 * Renewals desk: plans ending soon (and not yet renewed), members whose plan has lapsed, and the
 * history of renewals and plan changes. Read-only.
 */
import Membership from '../models/Membership.js';
import PlanHistory from '../models/PlanHistory.js';
import { endOfGymDay, startOfGymDay, dayjs } from '../utils/time.js';
import { daysLeft } from './membershipService.js';

const MEMBER_FIELDS = { name: 1, phone: 1, email: 1, memberCode: 1, profilePhoto: 1, isActive: 1 };

/** Stages that attach `member` and `dues` (pending amount) to rows that have `memberId`. */
function memberAndDues() {
  return [
    { $lookup: { from: 'members', localField: 'memberId', foreignField: '_id', as: 'member', pipeline: [{ $project: MEMBER_FIELDS }] } },
    { $unwind: '$member' },
    {
      $lookup: {
        from: 'payments',
        localField: 'memberId',
        foreignField: 'memberId',
        as: 'dueRows',
        pipeline: [{ $match: { status: 'pending' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }],
      },
    },
    { $addFields: { dues: { $ifNull: [{ $first: '$dueRows.amount' }, 0] } } },
    { $project: { dueRows: 0 } },
  ];
}

/** Excludes members who already have a renewal waiting (upcoming or awaiting payment). */
const notYetRenewed = [
  {
    $lookup: {
      from: 'memberships',
      localField: 'memberId',
      foreignField: 'memberId',
      as: 'next',
      pipeline: [{ $match: { status: { $in: ['upcoming', 'pending'] } } }, { $project: { _id: 1 } }, { $limit: 1 }],
    },
  },
  { $match: { next: { $size: 0 } } },
  { $project: { next: 0 } },
];

const WINDOWS = [7, 15, 30];

/**
 * Current plans ending between today and `within` gym days from now, soonest first, with counts
 * for the 7/15/30-day chips.
 */
export async function listEnding({ within = 7, page = 1, limit = 25, now = new Date() }) {
  const from = startOfGymDay(now);
  const bound = (days) => endOfGymDay(dayjs(now).add(days, 'day').toDate());
  const widest = Math.max(within, ...WINDOWS);
  const [result] = await Membership.aggregate([
    { $match: { status: { $in: ['active', 'paused'] }, endDate: { $gte: from, $lte: bound(widest) } } },
    ...notYetRenewed,
    {
      $facet: {
        rows: [
          { $match: { endDate: { $lte: bound(within) } } },
          { $sort: { endDate: 1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...memberAndDues(),
        ],
        total: [{ $match: { endDate: { $lte: bound(within) } } }, { $count: 'n' }],
        counts: [
          {
            $group: {
              _id: null,
              ...Object.fromEntries(WINDOWS.map((d) => [`d${d}`, { $sum: { $cond: [{ $lte: ['$endDate', bound(d)] }, 1, 0] } }])),
            },
          },
        ],
      },
    },
  ]);
  const counts = Object.fromEntries(WINDOWS.map((d) => [d, result.counts[0]?.[`d${d}`] || 0]));
  return {
    items: result.rows.map((r) => endingItem(r, now)),
    total: result.total[0]?.n || 0,
    page,
    limit,
    counts,
  };
}

function membershipSummary(m) {
  return {
    _id: m._id,
    planId: m.planId,
    planName: m.planName,
    status: m.status,
    startDate: m.startDate,
    endDate: m.endDate,
    price: m.price,
    freeze: m.freeze ? { startDate: m.freeze.startDate, endDate: m.freeze.endDate, days: m.freeze.days } : null,
  };
}

function endingItem(r, now) {
  return { member: r.member, membership: membershipSummary(r), daysLeft: daysLeft(r.endDate, now), dues: r.dues };
}

/**
 * Members whose latest plan ended in the last `since` days and who have nothing current or waiting.
 * Most recently lapsed first.
 */
export async function listLapsed({ since = 60, page = 1, limit = 25, now = new Date() }) {
  const earliest = startOfGymDay(dayjs(now).subtract(since, 'day').toDate());
  const isCurrent = {
    $or: [
      { $in: ['$status', ['paused', 'upcoming', 'pending']] },
      { $and: [{ $eq: ['$status', 'active'] }, { $gte: ['$endDate', now] }] },
    ],
  };
  // Plans that ran (a request withdrawn before it started doesn't count as lapsing).
  const ran = { $lt: ['$startDate', '$endDate'] };
  const [result] = await Membership.aggregate([
    { $match: { status: { $in: ['active', 'paused', 'upcoming', 'pending', 'expired', 'cancelled'] } } },
    { $addFields: { _current: { $cond: [isCurrent, 1, 0] }, _ran: { $cond: [ran, 1, 0] } } },
    { $group: { _id: '$memberId', hasCurrent: { $max: '$_current' }, ranAny: { $max: '$_ran' } } },
    { $match: { hasCurrent: 0, ranAny: 1 } },
    // The latest plan that actually ran.
    {
      $lookup: {
        from: 'memberships',
        localField: '_id',
        foreignField: 'memberId',
        as: 'lastRan',
        pipeline: [{ $match: { $expr: ran } }, { $sort: { endDate: -1 } }, { $limit: 1 }],
      },
    },
    { $addFields: { last: { $first: '$lastRan' } } },
    { $match: { 'last.endDate': { $gte: earliest, $lte: now } } },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$last', { memberId: '$_id' }] } } },
    {
      $facet: {
        rows: [{ $sort: { endDate: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }, ...memberAndDues()],
        total: [{ $count: 'n' }],
      },
    },
  ]);
  return {
    items: result.rows.map((r) => ({
      member: r.member,
      membership: membershipSummary(r),
      daysSinceEnd: -daysLeft(r.endDate, now),
      dues: r.dues,
    })),
    total: result.total[0]?.n || 0,
    page,
    limit,
  };
}

/** Renewals and plan changes (desk sales and member requests), newest first. */
export async function listRenewalHistory({ since = 30, type = 'all', page = 1, limit = 25, now = new Date() }) {
  const earliest = startOfGymDay(dayjs(now).subtract(since, 'day').toDate());
  const match = {
    changeType: type === 'all' ? { $in: ['renew', 'upgrade', 'downgrade'] } : type,
    changedAt: { $gte: earliest },
  };
  const [result] = await PlanHistory.aggregate([
    { $match: match },
    {
      $facet: {
        rows: [
          { $sort: { changedAt: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $lookup: { from: 'members', localField: 'memberId', foreignField: '_id', as: 'member', pipeline: [{ $project: MEMBER_FIELDS }] } },
          { $unwind: '$member' },
          {
            $lookup: {
              from: 'memberships',
              localField: 'membershipId',
              foreignField: '_id',
              as: 'membership',
              pipeline: [{ $project: { planName: 1, price: 1, status: 1, startDate: 1, endDate: 1, source: 1, createdBy: 1 } }],
            },
          },
          { $addFields: { membership: { $first: '$membership' } } },
          { $lookup: { from: 'plans', localField: 'fromPlanId', foreignField: '_id', as: 'fromPlan', pipeline: [{ $project: { name: 1 } }] } },
          {
            $lookup: {
              from: 'users',
              let: { uid: { $ifNull: ['$createdBy', '$membership.createdBy'] } },
              as: 'actor',
              pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$uid'] } } }, { $project: { name: 1, username: 1 } }],
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const items = result.rows.map((r) => {
    const source = r.source || (r.membership?.source === 'self' ? 'self' : 'desk');
    const actor = r.actor?.[0];
    return {
      _id: r._id,
      type: r.changeType,
      at: r.changedAt,
      member: r.member,
      planName: r.membership?.planName || '',
      fromPlanName: r.fromPlan?.[0]?.name || '',
      amount: r.amount ?? r.membership?.price ?? null,
      status: r.membership?.status || null,
      startDate: r.membership?.startDate || null,
      endDate: r.membership?.endDate || null,
      source,
      by: source === 'self' ? 'Member (online)' : actor ? actor.name || actor.username : null,
    };
  });
  return { items, total: result.total[0]?.n || 0, page, limit };
}
