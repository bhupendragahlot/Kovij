/**
 * OWNER: member app core module. The extras the member app's home screen needs that no other
 * endpoint provides: this week's visits, how busy the gym usually is right now, latest weight,
 * and unread updates. Membership standing comes from GET /api/member/membership.
 */
import Attendance from '../models/Attendance.js';
import BodyMeasurement from '../models/BodyMeasurement.js';
import { GYM_TZ, gymDayKey, toGymTime } from '../utils/time.js';
import { addDaysToKey } from './attendanceRules.js';
import { memberStats } from './attendanceService.js';
import { unreadCount } from './notificationService.js';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Monday-to-Sunday of the current gym week, with visited days marked. Pure. */
export function weekStrip(visitedKeys, todayKey) {
  const visited = new Set(visitedKeys);
  const dow = new Date(`${todayKey}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const monday = addDaysToKey(todayKey, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDaysToKey(monday, i);
    return { day, label: WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()], visited: visited.has(day), isToday: day === todayKey, isFuture: day > todayKey };
  });
}

/** Typical visits per hour on this weekday (average of the last 4), and how the current hour compares. Pure. */
export function crowdForecast(rows, weeks, hourNow) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, typical: 0 }));
  for (const r of rows) hours[r._id].typical = Math.round((r.n / Math.max(1, weeks)) * 10) / 10;
  const open = hours.filter((h) => h.typical > 0);
  const peak = open.reduce((max, h) => (h.typical > max ? h.typical : max), 0);
  const now = hours[hourNow]?.typical || 0;
  let level = 'quiet';
  if (peak && now >= peak * 0.7) level = 'busy';
  else if (peak && now >= peak * 0.35) level = 'moderate';
  // The next quieter hour after a busy spell, to suggest a better time.
  const quieterAt = level === 'busy' ? hours.slice(hourNow + 1).find((h) => h.typical > 0 && h.typical < peak * 0.5)?.hour ?? null : null;
  return { hours: open.length ? hours.slice(Math.max(0, open[0].hour - 1), Math.min(24, open.at(-1).hour + 2)) : [], level, quieterAt, hourNow };
}

export async function memberHome(memberId, now = new Date()) {
  const todayKey = gymDayKey(now);
  const gymNow = toGymTime(now);
  const sameWeekdays = [1, 2, 3, 4].map((w) => gymNow.subtract(w, 'week').format('YYYY-MM-DD'));

  const [stats, weekVisits, crowdRows, weights, unread] = await Promise.all([
    memberStats(memberId, now),
    Attendance.find({ memberId, dayKey: { $gte: addDaysToKey(todayKey, -7), $lte: todayKey } }).select('dayKey').lean(),
    Attendance.aggregate([
      { $match: { dayKey: { $in: sameWeekdays } } },
      { $group: { _id: { $hour: { date: '$checkedInAt', timezone: GYM_TZ } }, n: { $sum: 1 } } },
    ]),
    BodyMeasurement.find({ memberId, weightKg: { $gt: 0 } }).sort({ takenAt: 1 }).select('weightKg takenAt').lean(),
    unreadCount(memberId),
  ]);

  const firstWeight = weights[0];
  const lastWeight = weights.at(-1);
  return {
    visits: {
      thisMonth: stats.thisMonth,
      lastMonth: stats.trend?.at(-2)?.visits ?? 0,
      last30Days: stats.last30Days,
      lastVisitAt: stats.lastVisitAt,
      streak: stats.streak,
      week: weekStrip(weekVisits.map((v) => v.dayKey), todayKey),
    },
    crowd: crowdForecast(crowdRows, sameWeekdays.length, gymNow.hour()),
    weight: lastWeight
      ? { latestKg: lastWeight.weightKg, at: lastWeight.takenAt, changeKg: weights.length > 1 ? Math.round((lastWeight.weightKg - firstWeight.weightKg) * 10) / 10 : null }
      : null,
    unread,
  };
}
