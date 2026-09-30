import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import Attendance from '../models/Attendance.js';
import Lead from '../models/Lead.js';
import PlanHistory from '../models/PlanHistory.js';
import { GYM_TZ, dayjs, endOfGymDay, gymDayKey, startOfGymMonth, toGymTime } from '../utils/time.js';

const sumPaid = async (from, to) => {
  const [row] = await Payment.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return { amount: row?.amount || 0, count: row?.count || 0 };
};

const hourBuckets = (rows, divisor = 1) => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const r of rows) hours[r._id].count = Math.round((r.n / divisor) * 10) / 10;
  return hours;
};

async function checkInsByHour(dayKeys, divisor) {
  const rows = await Attendance.aggregate([
    { $match: { dayKey: { $in: dayKeys } } },
    { $group: { _id: { $hour: { date: '$checkedInAt', timezone: GYM_TZ } }, n: { $sum: 1 } } },
  ]);
  return hourBuckets(rows, divisor);
}

/** Members whose latest plan ended recently and who have nothing active or queued: win-back list. */
async function lapsedMembers(since, limit) {
  const stillCovered = await Membership.distinct('memberId', { status: { $in: ['active', 'upcoming', 'pending'] } });
  const match = { status: 'expired', endDate: { $gte: since, $lte: new Date() }, memberId: { $nin: stillCovered } };
  const [rows, ids] = await Promise.all([
    Membership.find(match).sort({ endDate: -1 }).limit(limit).populate('memberId', 'name phone memberCode profilePhoto').lean(),
    Membership.distinct('memberId', match),
  ]);
  return { count: ids.length, items: rows.filter((r) => r.memberId) };
}

/**
 * The desk's "what needs doing today" plus the owner's pulse numbers.
 * Money figures are included only when `canSeeRevenue`.
 */
export async function buildDashboard({ canSeeRevenue, expiringWindowDays = 7 }) {
  const now = new Date();
  const today = gymDayKey(now);
  const gymNow = toGymTime(now);
  const monthStart = startOfGymMonth(now);
  const prevMonthStart = gymNow.subtract(1, 'month').startOf('month').toDate();
  const prevMonthSamePoint = gymNow.subtract(1, 'month').toDate();
  const expiringUntil = dayjs(now).add(expiringWindowDays, 'day').toDate();
  const sameWeekdays = [1, 2, 3, 4].map((w) => gymNow.subtract(w, 'week').format('YYYY-MM-DD'));

  const [
    checkInsToday,
    byHourToday,
    byHourTypical,
    activeMemberIds,
    newThisMonth,
    newPrevMonth,
    dues,
    expiringCount,
    expiringItems,
    lapsed,
    leadsNew,
    followUpsDue,
  ] = await Promise.all([
    Attendance.countDocuments({ dayKey: today }),
    checkInsByHour([today], 1),
    checkInsByHour(sameWeekdays, sameWeekdays.length),
    Membership.distinct('memberId', { status: 'active' }),
    Member.countDocuments({ createdAt: { $gte: monthStart } }),
    Member.countDocuments({ createdAt: { $gte: prevMonthStart, $lt: prevMonthSamePoint } }),
    Payment.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Membership.countDocuments({ status: 'active', endDate: { $gte: now, $lte: expiringUntil } }),
    Membership.find({ status: 'active', endDate: { $gte: now, $lte: expiringUntil } })
      .sort({ endDate: 1 })
      .limit(8)
      .populate('memberId', 'name phone memberCode profilePhoto')
      .lean(),
    lapsedMembers(dayjs(now).subtract(14, 'day').toDate(), 5),
    Lead.countDocuments({ status: 'new' }),
    Lead.countDocuments({ status: { $in: ['new', 'contacted', 'trial'] }, nextFollowUpAt: { $lte: endOfGymDay(now) } }),
  ]);

  const recentPayments = await Payment.find({ status: 'paid' })
    .sort({ paidAt: -1 })
    .limit(6)
    .populate('memberId', 'name memberCode')
    .lean();
  const recentJoins = await Member.find().sort({ createdAt: -1 }).limit(4).select('name memberCode createdAt source').lean();
  const recentPlanChanges = await PlanHistory.find({ changeType: { $in: ['renew', 'upgrade', 'downgrade'] } })
    .sort({ createdAt: -1 })
    .limit(4)
    .populate('memberId', 'name memberCode')
    .populate('toPlanId', 'name')
    .lean();

  const activity = [
    ...recentPayments
      .filter((p) => p.memberId)
      .map((p) => ({
        kind: 'payment',
        at: p.paidAt,
        memberId: p.memberId._id,
        memberName: p.memberId.name,
        paymentType: p.type,
        ...(canSeeRevenue && { amount: p.amount }),
      })),
    ...recentJoins.map((m) => ({ kind: 'join', at: m.createdAt, memberId: m._id, memberName: m.name, source: m.source })),
    ...recentPlanChanges
      .filter((h) => h.memberId)
      .map((h) => ({
        kind: h.changeType,
        at: h.createdAt,
        memberId: h.memberId._id,
        memberName: h.memberId.name,
        planName: h.toPlanId?.name || '',
      })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8);

  const dashboard = {
    generatedAt: now,
    today: {
      date: today,
      checkIns: checkInsToday,
      byHour: byHourToday.map((h, i) => ({ ...h, typical: byHourTypical[i].count })),
    },
    members: {
      active: activeMemberIds.length,
      newThisMonth,
      newPrevMonthToDate: newPrevMonth,
    },
    dues: { amount: dues[0]?.amount || 0, count: dues[0]?.count || 0 },
    expiring: {
      windowDays: expiringWindowDays,
      count: expiringCount,
      items: expiringItems
        .filter((m) => m.memberId)
        .map((m) => ({
          membershipId: m._id,
          memberId: m.memberId._id,
          name: m.memberId.name,
          phone: m.memberId.phone,
          memberCode: m.memberId.memberCode,
          photo: m.memberId.profilePhoto,
          planName: m.planName,
          endDate: m.endDate,
        })),
    },
    lapsed: {
      count: lapsed.count,
      items: lapsed.items.map((m) => ({
        memberId: m.memberId._id,
        name: m.memberId.name,
        phone: m.memberId.phone,
        memberCode: m.memberId.memberCode,
        planName: m.planName,
        endDate: m.endDate,
      })),
    },
    leads: { new: leadsNew, followUpsDue },
    activity,
  };

  if (canSeeRevenue) {
    const months = Array.from({ length: 6 }, (_, i) => gymNow.subtract(5 - i, 'month').startOf('month'));
    const byMonth = await Payment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: months[0].toDate() } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: GYM_TZ } },
          amount: { $sum: '$amount' },
        },
      },
    ]);
    const lookup = Object.fromEntries(byMonth.map((r) => [r._id, r.amount]));
    const [mtd, prevMtd] = await Promise.all([sumPaid(monthStart, now), sumPaid(prevMonthStart, prevMonthSamePoint)]);
    dashboard.revenue = {
      monthToDate: mtd.amount,
      prevMonthToDate: prevMtd.amount,
      byMonth: months.map((m) => ({ month: m.format('YYYY-MM'), amount: lookup[m.format('YYYY-MM')] || 0 })),
    };
  }

  return dashboard;
}
