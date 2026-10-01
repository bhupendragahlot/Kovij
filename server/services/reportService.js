/**
 * OWNER: reports & dashboard module. Business reports for owners and managers (reports.view).
 *
 * One overview for a period (members, renewals, plans, attendance, enquiries) plus the
 * "not coming in" list. Gym time throughout; refunds never count as money in (status 'refunded').
 * Pure helpers (resolvePeriod, classifyRenewal, renewalSummary, heatmapFromRows) are unit-tested.
 */
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';
import Lead from '../models/Lead.js';
import { GYM_TZ, dayjs, gymDayKey, parseGymDay, toGymTime } from '../utils/time.js';
import { joinedBetween } from './dashboardService.js';
import { AppError } from '../middleware/errorHandler.js';

/** A renewal counts if the next plan starts within this many days of the last one ending. */
export const RENEWAL_GRACE_DAYS = 30;
export const MAX_PERIOD_DAYS = 366;
const DAY_MS = 86_400_000;

/**
 * `from`/`to` are gym days (YYYY-MM-DD, inclusive); default: this month so far.
 * Returns Date bounds [from, to) plus the previous period of the same length, for comparison.
 */
export function resolvePeriod({ from, to } = {}, now = new Date()) {
  const today = toGymTime(now).startOf('day');
  const start = from ? parseGymDay(from).startOf('day') : today.startOf('month');
  const last = to ? parseGymDay(to).startOf('day') : today;
  if (last.isBefore(start)) throw new AppError('The start date must be before the end date', 422, 'VALIDATION_ERROR', { fields: { to: 'Pick an end date after the start date' } });
  const days = last.diff(start, 'day') + 1;
  if (days > MAX_PERIOD_DAYS) throw new AppError('Choose a period of at most a year', 422, 'VALIDATION_ERROR', { fields: { from: 'Choose at most a year' } });
  const end = last.add(1, 'day');
  const prevStart = start.subtract(days, 'day');
  return {
    from: start.toDate(),
    to: end.toDate(),
    fromKey: start.format('YYYY-MM-DD'),
    toKey: last.format('YYYY-MM-DD'),
    days,
    prev: { from: prevStart.toDate(), to: start.toDate(), fromKey: prevStart.format('YYYY-MM-DD'), toKey: start.subtract(1, 'day').format('YYYY-MM-DD') },
  };
}

/**
 * What happened after a plan ended.
 *   on_time    the next plan started by the day after (or was queued before the end)
 *   late       the next plan started within the grace period
 *   undecided  nothing yet, but the grace period isn't over
 *   lost       nothing within the grace period
 */
export function classifyRenewal({ endDate, nextStart }, now = new Date(), graceDays = RENEWAL_GRACE_DAYS) {
  const end = new Date(endDate).getTime();
  if (nextStart) {
    const next = new Date(nextStart).getTime();
    if (next <= end + DAY_MS) return 'on_time';
    if (next <= end + graceDays * DAY_MS) return 'late';
  }
  return now.getTime() - end < graceDays * DAY_MS ? 'undecided' : 'lost';
}

/** Counts per outcome and the renewal rate over plans whose outcome is known. */
export function renewalSummary(outcomes) {
  const counts = { on_time: 0, late: 0, undecided: 0, lost: 0 };
  for (const o of outcomes) counts[o] += 1;
  const decided = counts.on_time + counts.late + counts.lost;
  return { ended: outcomes.length, ...counts, rate: decided ? Math.round(((counts.on_time + counts.late) / decided) * 1000) / 10 : null };
}

/** [{ _id: { dow: 1-7 (Sunday=1), hour }, n }] → 7×24 grid, Monday first, plus the busiest slot. */
export function heatmapFromRows(rows) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  let busiest = null;
  for (const r of rows) {
    const day = (r._id.dow + 5) % 7; // Monday = 0 … Sunday = 6
    grid[day][r._id.hour] = r.n;
    if (!busiest || r.n > busiest.count) busiest = { day, hour: r._id.hour, count: r.n };
  }
  return { grid, busiest };
}

const pct = (current, previous) => (previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

/** Plans that ended in [from, to) (and not later than now), each with the start of the member's next plan. */
export async function endedPlansWithNext(from, to, now) {
  return Membership.aggregate([
    { $match: { endDate: { $gte: from, $lt: to < now ? to : now }, status: { $in: ['expired', 'active', 'paused'] } } },
    {
      $lookup: {
        from: 'memberships',
        let: { member: '$memberId', start: '$startDate', id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$memberId', '$$member'] },
                  { $ne: ['$_id', '$$id'] },
                  { $gt: ['$startDate', '$$start'] },
                  // Paid or started plans only: an unpaid request isn't a renewal yet.
                  { $in: ['$status', ['active', 'upcoming', 'expired', 'paused']] },
                ],
              },
            },
          },
          { $sort: { startDate: 1 } },
          { $limit: 1 },
          { $project: { startDate: 1 } },
        ],
        as: 'next',
      },
    },
    { $project: { memberId: 1, planName: 1, endDate: 1, nextStart: { $arrayElemAt: ['$next.startDate', 0] } } },
  ]);
}

async function membersSection(period, now) {
  const [activeIds, frozenIds, joined, joinedPrev, byChannel, bySource] = await Promise.all([
    Membership.distinct('memberId', { status: 'active' }),
    Membership.distinct('memberId', { status: 'paused' }),
    Member.countDocuments(joinedBetween(period.from, period.to)),
    Member.countDocuments(joinedBetween(period.prev.from, period.prev.to)),
    Member.aggregate([{ $match: joinedBetween(period.from, period.to) }, { $group: { _id: { $ifNull: ['$referral.channel', 'unknown'] }, count: { $sum: 1 } } }]),
    Member.aggregate([{ $match: joinedBetween(period.from, period.to) }, { $group: { _id: { $ifNull: ['$source', 'desk'] }, count: { $sum: 1 } } }]),
  ]);

  // Joins per month for the last 12 months (joining date, else record creation).
  const yearStart = toGymTime(now).startOf('month').subtract(11, 'month');
  const joinsByMonth = await Member.aggregate([
    { $project: { joined: { $ifNull: ['$joinedAt', '$createdAt'] } } },
    { $match: { joined: { $gte: yearStart.toDate() } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$joined', timezone: GYM_TZ } }, count: { $sum: 1 } } },
  ]);
  const joinsLookup = Object.fromEntries(joinsByMonth.map((r) => [r._id, r.count]));

  return {
    activeNow: activeIds.length,
    frozenNow: frozenIds.length,
    joined,
    joinedPrev,
    joinedChange: pct(joined, joinedPrev),
    byChannel: byChannel.map((r) => ({ channel: r._id, count: r.count })).sort((a, b) => b.count - a.count),
    bySource: bySource.map((r) => ({ source: r._id, count: r.count })).sort((a, b) => b.count - a.count),
    joinsByMonth: Array.from({ length: 12 }, (_, i) => {
      const key = yearStart.add(i, 'month').format('YYYY-MM');
      return { month: key, joined: joinsLookup[key] || 0 };
    }),
  };
}

async function renewalsSection(period, now) {
  const yearStart = toGymTime(now).startOf('month').subtract(11, 'month');
  const [ended, endedYear] = await Promise.all([endedPlansWithNext(period.from, period.to, now), endedPlansWithNext(yearStart.toDate(), now, now)]);
  const withOutcome = ended.map((p) => ({ ...p, outcome: classifyRenewal(p, now) }));

  const byMonth = {};
  for (const p of endedYear) {
    const key = toGymTime(p.endDate).format('YYYY-MM');
    (byMonth[key] ||= []).push(classifyRenewal(p, now));
  }

  return {
    graceDays: RENEWAL_GRACE_DAYS,
    ...renewalSummary(withOutcome.map((p) => p.outcome)),
    byPlan: Object.values(
      withOutcome.reduce((acc, p) => {
        const key = p.planName || 'Plan';
        acc[key] ||= { planName: key, outcomes: [] };
        acc[key].outcomes.push(p.outcome);
        return acc;
      }, {})
    )
      .map(({ planName, outcomes }) => ({ planName, ...renewalSummary(outcomes) }))
      .sort((a, b) => b.ended - a.ended),
    byMonth: Array.from({ length: 12 }, (_, i) => {
      const key = yearStart.add(i, 'month').format('YYYY-MM');
      return { month: key, ...renewalSummary(byMonth[key] || []) };
    }),
  };
}

async function plansSection(period) {
  const [sold, current] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: period.from, $lt: period.to }, type: { $in: ['membership', 'renewal'] }, membershipId: { $ne: null } } },
      { $lookup: { from: 'memberships', localField: 'membershipId', foreignField: '_id', as: 'm' } },
      { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$m.planName', 0] }, 'Plan'] }, amount: { $sum: '$amount' }, memberships: { $addToSet: '$membershipId' } } },
      { $project: { amount: 1, sold: { $size: '$memberships' } } },
    ]),
    Membership.aggregate([{ $match: { status: { $in: ['active', 'paused'] } } }, { $group: { _id: { $ifNull: ['$planName', 'Plan'] }, members: { $addToSet: '$memberId' } } }, { $project: { count: { $size: '$members' } } }]),
  ]);
  return {
    sold: sold.map((r) => ({ planName: r._id, sold: r.sold, amount: Math.round(r.amount) })).sort((a, b) => b.amount - a.amount),
    current: current.map((r) => ({ planName: r._id, members: r.count })).sort((a, b) => b.members - a.members),
  };
}

async function attendanceSection(period, now, atRiskDays) {
  const match = { dayKey: { $gte: period.fromKey, $lte: period.toKey } };
  const [visits, visitsPrev, visitors, heatRows, byDay, atRisk] = await Promise.all([
    Attendance.countDocuments(match),
    Attendance.countDocuments({ dayKey: { $gte: period.prev.fromKey, $lte: period.prev.toKey } }),
    Attendance.distinct('memberId', match),
    Attendance.aggregate([
      { $match: match },
      { $group: { _id: { dow: { $dayOfWeek: { date: '$checkedInAt', timezone: GYM_TZ } }, hour: { $hour: { date: '$checkedInAt', timezone: GYM_TZ } } }, n: { $sum: 1 } } },
    ]),
    Attendance.aggregate([{ $match: match }, { $group: { _id: '$dayKey', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    notComingIn({ days: atRiskDays, now, countOnly: true }),
  ]);
  const { grid, busiest } = heatmapFromRows(heatRows);
  return {
    visits,
    visitsPrev,
    visitsChange: pct(visits, visitsPrev),
    visitors: visitors.length,
    visitsPerVisitor: visitors.length ? Math.round((visits / visitors.length) * 10) / 10 : 0,
    heatmap: grid,
    busiest,
    byDay: byDay.map((r) => ({ day: r._id, visits: r.n })),
    notComingIn: { days: atRiskDays, count: atRisk },
  };
}

async function enquiriesSection(period) {
  const match = { createdAt: { $gte: period.from, $lt: period.to }, 'triage.spam': { $ne: true } };
  const [byStatus, bySource, prev, lostReasons] = await Promise.all([
    Lead.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$source', count: { $sum: 1 }, won: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } } } }]),
    Lead.countDocuments({ createdAt: { $gte: period.prev.from, $lt: period.prev.to }, 'triage.spam': { $ne: true } }),
    Lead.aggregate([
      { $match: { ...match, status: 'lost', lostReason: { $nin: ['', null] } } },
      { $group: { _id: { $toLower: { $trim: { input: '$lostReason' } } }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);
  const statuses = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
  const total = byStatus.reduce((s, r) => s + r.count, 0);
  const won = statuses.won || 0;
  return {
    total,
    prev,
    change: pct(total, prev),
    won,
    conversionRate: total ? Math.round((won / total) * 1000) / 10 : null,
    byStatus: statuses,
    bySource: bySource.map((r) => ({ source: r._id, count: r.count, won: r.won })).sort((a, b) => b.count - a.count),
    lostReasons: lostReasons.map((r) => ({ reason: r._id, count: r.count })),
  };
}

/** Everything on the Reports page for one period. */
export async function reportOverview({ from, to, atRiskDays = 14, now = new Date() } = {}) {
  const period = resolvePeriod({ from, to }, now);
  const [members, renewals, plans, attendance, enquiries] = await Promise.all([
    membersSection(period, now),
    renewalsSection(period, now),
    plansSection(period),
    attendanceSection(period, now, atRiskDays),
    enquiriesSection(period),
  ]);
  return {
    period: { from: period.fromKey, to: period.toKey, days: period.days, prevFrom: period.prev.fromKey, prevTo: period.prev.toKey },
    generatedAt: now,
    members,
    renewals,
    plans,
    attendance,
    enquiries,
  };
}

/**
 * Members on a current plan who haven't been in for `days` days (or never since their plan
 * started): the people to call before they quietly stop paying.
 */
export async function notComingIn({ days = 14, now = new Date(), page = 1, limit = 25, countOnly = false } = {}) {
  const current = await Membership.find({ status: 'active' }).select('memberId planName startDate endDate').sort({ endDate: 1 }).lean();
  const byMember = new Map();
  for (const m of current) if (!byMember.has(String(m.memberId))) byMember.set(String(m.memberId), m);
  const ids = [...byMember.values()].map((m) => m.memberId);
  const lastVisits = await Attendance.aggregate([{ $match: { memberId: { $in: ids } } }, { $group: { _id: '$memberId', last: { $max: '$checkedInAt' } } }]);
  const lastBy = new Map(lastVisits.map((r) => [String(r._id), r.last]));
  const cutoff = dayjs(now).subtract(days, 'day').toDate();

  const quiet = [...byMember.entries()]
    .map(([id, m]) => ({ memberId: id, membership: m, lastVisit: lastBy.get(id) || null }))
    // Recently started plans get a grace period before "never came" counts.
    .filter((r) => (r.lastVisit ? r.lastVisit < cutoff : new Date(r.membership.startDate) < cutoff))
    .sort((a, b) => (a.lastVisit ? a.lastVisit.getTime() : 0) - (b.lastVisit ? b.lastVisit.getTime() : 0));
  if (countOnly) return quiet.length;

  const slice = quiet.slice((page - 1) * limit, page * limit);
  const members = await Member.find({ _id: { $in: slice.map((r) => r.memberId) } })
    .select('name phone memberCode profilePhoto assignedTrainerId')
    .populate('assignedTrainerId', 'name')
    .lean();
  const memberBy = new Map(members.map((m) => [String(m._id), m]));
  return {
    days,
    total: quiet.length,
    page,
    limit,
    items: slice
      .filter((r) => memberBy.has(r.memberId))
      .map((r) => {
        const m = memberBy.get(r.memberId);
        return {
          memberId: r.memberId,
          name: m.name,
          phone: m.phone || '',
          memberCode: m.memberCode || '',
          photo: m.profilePhoto || '',
          trainer: m.assignedTrainerId?.name || '',
          planName: r.membership.planName,
          planEnds: r.membership.endDate,
          lastVisit: r.lastVisit,
          daysAway: r.lastVisit ? Math.floor((now - r.lastVisit) / DAY_MS) : null,
        };
      }),
  };
}

export { gymDayKey };
