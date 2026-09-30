/**
 * Revenue management: what came in, what is still owed, what was spent. All figures are INR in
 * gym time. Revenue counts only `paid` payments by the day the money came in, so refunded
 * payments (status `refunded`) drop out of every figure; refunds are reported on their own.
 */
import Payment from '../models/Payment.js';
import Expense from '../models/Expense.js';
import { GYM_TZ, parseGymDay, toGymTime } from '../utils/time.js';
import { roundMoney } from './paymentService.js';

/** Revenue buckets: the payment types, as shown to the owner. */
export const REVENUE_TYPES = ['membership', 'renewal', 'registration', 'personal_training', 'other'];
export const AGEING_BUCKETS = [
  { key: '0_7', label: '0–7 days', minDays: 0, maxDays: 7 },
  { key: '8_30', label: '8–30 days', minDays: 8, maxDays: 30 },
  { key: '31_plus', label: 'Over 30 days', minDays: 31, maxDays: null },
];

/**
 * The periods compared on the revenue page, relative to `now` (gym time). "So far" comparisons
 * stop at the same point in the previous period, so a half-finished month is compared fairly.
 */
export function comparisonPeriods(now = new Date()) {
  const g = toGymTime(now);
  const today = g.startOf('day');
  const month = g.startOf('month');
  const year = g.startOf('year');
  const prevMonthStart = month.subtract(1, 'month');
  // Same point last month, clamped so 31 March compares with the end of February, not 3 March.
  const prevMonthPoint = g.subtract(1, 'month');
  return {
    today: { from: today.toDate(), to: now, prevFrom: today.subtract(1, 'day').toDate(), prevTo: g.subtract(1, 'day').toDate() },
    month: { from: month.toDate(), to: now, prevFrom: prevMonthStart.toDate(), prevTo: prevMonthPoint.toDate() },
    year: { from: year.toDate(), to: now, prevFrom: year.subtract(1, 'year').toDate(), prevTo: g.subtract(1, 'year').toDate() },
  };
}

/** Ageing bucket for a due raised `raisedAt`, in whole gym days. Pure. */
export function ageingBucket(raisedAt, now = new Date()) {
  const days = toGymTime(now).startOf('day').diff(toGymTime(raisedAt).startOf('day'), 'day');
  return AGEING_BUCKETS.find((b) => days >= b.minDays && (b.maxDays == null || days <= b.maxDays))?.key || AGEING_BUCKETS[0].key;
}

/** The selected month (`YYYY-MM`, gym time) as a half-open Date range. */
export function monthRange(month, now = new Date()) {
  const start = month ? parseGymDay(`${month}-01`).startOf('month') : toGymTime(now).startOf('month');
  const end = start.add(1, 'month');
  return { key: start.format('YYYY-MM'), start, end, from: start.toDate(), to: end.toDate() };
}

async function sumPaid(from, to) {
  const [row] = await Payment.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return { amount: roundMoney(row?.amount), count: row?.count || 0 };
}

async function groupPaid(from, to, field) {
  const rows = await Payment.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: `$${field}`, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id || 'unknown', { amount: roundMoney(r.amount), count: r.count }]));
}

async function paidByDay(from, to) {
  const rows = await Payment.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: GYM_TZ } }, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, { amount: roundMoney(r.amount), count: r.count }]));
}

async function paidByMonth(from, to) {
  const rows = await Payment.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: GYM_TZ } }, amount: { $sum: '$amount' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, roundMoney(r.amount)]));
}

async function expensesIn(from, to) {
  const rows = await Expense.aggregate([
    { $match: { deletedAt: null, spentOn: { $gte: from, $lt: to } } },
    { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const byCategory = Object.fromEntries(rows.map((r) => [r._id, { amount: roundMoney(r.amount), count: r.count }]));
  return { total: roundMoney(rows.reduce((s, r) => s + r.amount, 0)), count: rows.reduce((s, r) => s + r.count, 0), byCategory };
}

async function refundsIn(from, to) {
  const [row] = await Payment.aggregate([
    { $match: { status: 'refunded', 'refund.at': { $gte: from, $lt: to } } },
    { $group: { _id: null, amount: { $sum: { $ifNull: ['$refund.amount', '$amount'] } }, count: { $sum: 1 } } },
  ]);
  return { amount: roundMoney(row?.amount), count: row?.count || 0 };
}

/** Dues still owed right now, split by how long ago they were raised. */
export async function outstandingDues(now = new Date()) {
  const g = toGymTime(now).startOf('day');
  const b8 = g.subtract(7, 'day').toDate(); // raised before this → at least 8 days old
  const b31 = g.subtract(30, 'day').toDate(); // raised before this → at least 31 days old
  const rows = await Payment.aggregate([
    { $match: { status: 'pending' } },
    {
      $group: {
        _id: { $switch: { branches: [{ case: { $gte: ['$createdAt', b8] }, then: '0_7' }, { case: { $gte: ['$createdAt', b31] }, then: '8_30' }], default: '31_plus' } },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
        members: { $addToSet: '$memberId' },
      },
    },
  ]);
  const byKey = Object.fromEntries(rows.map((r) => [r._id, r]));
  const allMembers = new Set(rows.flatMap((r) => r.members.map(String)));
  return {
    total: roundMoney(rows.reduce((s, r) => s + r.amount, 0)),
    count: rows.reduce((s, r) => s + r.count, 0),
    members: allMembers.size,
    ageing: AGEING_BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: roundMoney(byKey[b.key]?.amount), count: byKey[b.key]?.count || 0 })),
  };
}

/**
 * Everything the revenue page shows, for the month picked (default: this month).
 * Headline tiles are always "today / this month / this year so far" against the previous period.
 */
export async function financeOverview({ month, now = new Date() } = {}) {
  const periods = comparisonPeriods(now);
  const sel = monthRange(month, now);
  const currentKey = toGymTime(now).format('YYYY-MM');
  const isCurrentMonth = sel.key === currentKey;
  const isFuture = sel.key > currentKey;
  const trendStart = sel.start.subtract(11, 'month');

  const [today, todayPrev, mtd, mtdPrev, ytd, ytdPrev, monthTotal, byMode, byType, days, months, expenses, refunds, outstanding] = await Promise.all([
    sumPaid(periods.today.from, periods.today.to),
    sumPaid(periods.today.prevFrom, periods.today.prevTo),
    sumPaid(periods.month.from, periods.month.to),
    sumPaid(periods.month.prevFrom, periods.month.prevTo),
    sumPaid(periods.year.from, periods.year.to),
    sumPaid(periods.year.prevFrom, periods.year.prevTo),
    sumPaid(sel.from, sel.to),
    groupPaid(sel.from, sel.to, 'mode'),
    groupPaid(sel.from, sel.to, 'type'),
    paidByDay(sel.from, sel.to),
    paidByMonth(trendStart.toDate(), sel.to),
    expensesIn(sel.from, sel.to),
    refundsIn(sel.from, sel.to),
    outstandingDues(now),
  ]);

  // Daily bars run to today for the current month, and cover the whole month otherwise.
  const lastDay = isCurrentMonth ? toGymTime(now).date() : isFuture ? 0 : sel.start.daysInMonth();
  const daily = Array.from({ length: lastDay }, (_, i) => {
    const key = sel.start.add(i, 'day').format('YYYY-MM-DD');
    return { day: key, amount: days[key]?.amount || 0, count: days[key]?.count || 0 };
  });
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const key = trendStart.add(i, 'month').format('YYYY-MM');
    return { month: key, amount: months[key] || 0 };
  });

  const modes = ['cash', 'upi', 'card', 'online'];
  return {
    month: sel.key,
    isCurrentMonth,
    summary: {
      today: { amount: today.amount, count: today.count, previous: todayPrev.amount, compareLabel: 'yesterday by this time' },
      month: { amount: mtd.amount, count: mtd.count, previous: mtdPrev.amount, compareLabel: 'last month so far' },
      year: { amount: ytd.amount, count: ytd.count, previous: ytdPrev.amount, compareLabel: 'last year so far', year: toGymTime(now).format('YYYY') },
    },
    selected: {
      collected: monthTotal.amount,
      payments: monthTotal.count,
      expenses: expenses.total,
      net: roundMoney(monthTotal.amount - expenses.total),
      refunds,
    },
    daily,
    monthly,
    byMode: modes.map((m) => ({ mode: m, amount: byMode[m]?.amount || 0, count: byMode[m]?.count || 0 })),
    byType: REVENUE_TYPES.map((t) => ({ type: t, amount: byType[t]?.amount || 0, count: byType[t]?.count || 0 })),
    expensesByCategory: expenses.byCategory,
    outstanding,
  };
}
