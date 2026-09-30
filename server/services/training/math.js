/**
 * Pure training logic: no database, no clock. Everything here is covered by
 * server/tests/training.test.js.
 */
import { WEEKDAY_SHORT } from './constants.js';

const roundTo = (value, step) => Math.round(value / step) * step;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ── Sets, sessions and strength estimates ──────────────────────────────────

/**
 * Estimated one-rep max (Epley). 0 when there is no load, so bodyweight work is compared by
 * reps instead. Rounded to 0.5 kg, the smallest plate step most gyms have.
 */
export function estimateOneRepMax(weightKg, reps) {
  const w = num(weightKg);
  const r = Math.floor(num(reps));
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return roundTo(w, 0.5);
  return roundTo(w * (1 + r / 30), 0.5);
}

const isDone = (set) => set && set.done !== false && num(set.reps) > 0;

/** Totals for one logged session. Only finished sets count. */
export function summarizeEntries(entries = []) {
  let volumeKg = 0;
  let setsDone = 0;
  let repsDone = 0;
  for (const entry of entries) {
    for (const set of entry.sets || []) {
      if (!isDone(set)) continue;
      setsDone += 1;
      repsDone += Math.floor(num(set.reps));
      volumeKg += Math.floor(num(set.reps)) * num(set.weightKg);
    }
  }
  return { volumeKg: Math.round(volumeKg * 10) / 10, setsDone, repsDone };
}

/**
 * The best finished set: highest estimated 1RM, then heavier, then more reps.
 * For bodyweight sets (no load) that means the set with the most reps.
 */
export function bestSet(sets = []) {
  let best = null;
  for (const set of sets) {
    if (!isDone(set)) continue;
    const candidate = { reps: Math.floor(num(set.reps)), weightKg: num(set.weightKg), e1rm: estimateOneRepMax(set.weightKg, set.reps) };
    if (
      !best ||
      candidate.e1rm > best.e1rm ||
      (candidate.e1rm === best.e1rm && candidate.weightKg > best.weightKg) ||
      (candidate.e1rm === best.e1rm && candidate.weightKg === best.weightKg && candidate.reps > best.reps)
    ) {
      best = candidate;
    }
  }
  return best;
}

const logTime = (log) => new Date(log.performedAt || log.createdAt || 0).getTime();

/**
 * One exercise across sessions, oldest first: best set, estimated 1RM, volume and reps per
 * session. Sessions where the exercise has no finished set are left out.
 */
export function exerciseSeries(logs = [], exerciseId) {
  const id = String(exerciseId);
  const points = [];
  for (const log of [...logs].sort((a, b) => logTime(a) - logTime(b))) {
    const sets = (log.entries || []).filter((e) => String(e.exerciseId) === id).flatMap((e) => e.sets || []);
    const best = bestSet(sets);
    if (!best) continue;
    const totals = summarizeEntries([{ sets }]);
    points.push({
      logId: log._id ? String(log._id) : undefined,
      dayKey: log.dayKey,
      bestSet: { reps: best.reps, weightKg: best.weightKg },
      e1rm: best.e1rm,
      volumeKg: totals.volumeKg,
      reps: totals.repsDone,
      sets: totals.setsDone,
    });
  }
  return points;
}

/** The personal best among series points: highest estimated 1RM, or most reps when unloaded. */
export function personalBest(points = []) {
  let best = null;
  for (const p of points) {
    if (!best || p.e1rm > best.e1rm || (p.e1rm === best.e1rm && p.bestSet.reps > best.bestSet.reps)) best = p;
  }
  return best;
}

/**
 * Every exercise a member has logged, most recently trained first, with session count,
 * last and best set. `logs` are that member's sessions in any order.
 */
export function exerciseOverview(logs = []) {
  const names = new Map();
  for (const log of logs) for (const e of log.entries || []) if (!names.has(String(e.exerciseId))) names.set(String(e.exerciseId), e.name);
  const rows = [];
  for (const [exerciseId, name] of names) {
    const points = exerciseSeries(logs, exerciseId);
    if (!points.length) continue;
    const last = points[points.length - 1];
    const best = personalBest(points);
    rows.push({
      exerciseId,
      name,
      sessions: points.length,
      lastDayKey: last.dayKey,
      last: { ...last.bestSet, e1rm: last.e1rm },
      best: { ...best.bestSet, e1rm: best.e1rm, dayKey: best.dayKey },
      _lastTime: logTime(logs.find((l) => l.dayKey === last.dayKey) || {}),
    });
  }
  return rows.sort((a, b) => b._lastTime - a._lastTime || b.sessions - a.sessions).map(({ _lastTime, ...r }) => r);
}

// ── Membership standing (for coaching lists) ───────────────────────────────

/**
 * Same states as the members list: active | expiring | pending | upcoming | expired | none,
 * plus the membership that decides it.
 */
export function memberStanding(memberships = [], now = new Date(), expiringDays = 7) {
  const latest = (statuses) =>
    memberships.filter((m) => statuses.includes(m.status)).sort((a, b) => new Date(b.endDate) - new Date(a.endDate))[0];
  const active = latest(['active']);
  if (active) {
    const until = now.getTime() + expiringDays * 86_400_000;
    return { state: new Date(active.endDate).getTime() <= until ? 'expiring' : 'active', current: active };
  }
  const pending = latest(['pending']);
  if (pending) return { state: 'pending', current: pending };
  const upcoming = latest(['upcoming']);
  if (upcoming) return { state: 'upcoming', current: upcoming };
  const ended = latest(['expired', 'cancelled']);
  if (ended) return { state: 'expired', current: ended };
  return { state: 'none', current: null };
}

// ── Plan rotation ──────────────────────────────────────────────────────────

/**
 * Which day of the plan to do next. Plans rotate: after "Day 2" comes "Day 3", then back to
 * "Day 1", whatever the calendar says, because members miss days.
 *
 * @param {{ dayCount: number, logs: {dayKey:string, dayIndex:number, performedAt?:Date, createdAt?:Date}[], todayKey: string }} input
 *   `logs` are this assignment's sessions, in any order.
 * @returns {{ dayIndex: number, doneToday: boolean, lastDayKey: string|null } | null}
 */
export function suggestNextDay({ dayCount, logs = [], todayKey }) {
  if (!dayCount) return null;
  const valid = logs.filter((l) => Number.isInteger(l.dayIndex) && l.dayIndex >= 0 && l.dayIndex < dayCount);
  const ordered = [...valid].sort((a, b) => logTime(a) - logTime(b) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const today = ordered.filter((l) => l.dayKey === todayKey);
  if (today.length) {
    const last = today[today.length - 1];
    return { dayIndex: last.dayIndex, doneToday: true, lastDayKey: last.dayKey };
  }
  const last = ordered[ordered.length - 1];
  if (!last) return { dayIndex: 0, doneToday: false, lastDayKey: null };
  return { dayIndex: (last.dayIndex + 1) % dayCount, doneToday: false, lastDayKey: last.dayKey };
}

// ── Trainer performance ────────────────────────────────────────────────────

/**
 * A member's standing from their membership statuses, for coaching numbers:
 * active (training now), waiting (paid or starting soon), lapsed (had a plan, none now), none.
 */
export function standingFromStatuses(statuses = []) {
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('pending') || statuses.includes('upcoming')) return 'waiting';
  if (statuses.includes('expired') || statuses.includes('cancelled')) return 'lapsed';
  return 'none';
}

/**
 * Fold per-member facts into one row per trainer.
 * @param {string[]} trainerIds  every trainer to report, even with no members
 * @param {{ trainerId: string, standing: string, visits30: number, onPlan: boolean, sessions30: number }[]} rows
 */
export function summarizeTrainerPerformance(trainerIds, rows) {
  const out = new Map(
    trainerIds.map((id) => [String(id), { trainerId: String(id), members: 0, active: 0, lapsed: 0, onPlan: 0, visits30: 0, sessions30: 0 }])
  );
  for (const row of rows) {
    const t = out.get(String(row.trainerId));
    if (!t) continue;
    t.members += 1;
    if (row.standing === 'active') t.active += 1;
    if (row.standing === 'lapsed') t.lapsed += 1;
    if (row.onPlan) t.onPlan += 1;
    t.visits30 += num(row.visits30);
    t.sessions30 += num(row.sessions30);
  }
  return [...out.values()].map(({ visits30, ...t }) => ({
    ...t,
    visits30,
    avgVisits30: t.members ? Math.round((visits30 / t.members) * 10) / 10 : 0,
  }));
}

// ── Trainer schedule ───────────────────────────────────────────────────────

/** "06:30" → 390. Returns NaN for anything else. */
export function toMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** Days sorted Sunday→Saturday, shifts sorted by start, days without shifts dropped. */
export function normalizeSchedule(schedule = []) {
  return [...schedule]
    .map((d) => ({ day: Number(d.day), shifts: [...(d.shifts || [])].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)) }))
    .filter((d) => d.shifts.length)
    .sort((a, b) => a.day - b.day);
}

/**
 * Problems a person must fix before a schedule can be saved, as [{ path, message }] with
 * paths relative to the schedule array (e.g. [2, 'shifts', 1, 'end']).
 */
export function scheduleProblems(schedule = []) {
  const problems = [];
  const seen = new Set();
  schedule.forEach((d, i) => {
    if (seen.has(d.day)) problems.push({ path: [i, 'day'], message: `${WEEKDAY_SHORT[d.day] || 'This day'} is listed twice` });
    seen.add(d.day);
    const shifts = (d.shifts || []).map((s, j) => ({ ...s, j, from: toMinutes(s.start), to: toMinutes(s.end) }));
    for (const s of shifts) {
      if (s.to <= s.from) problems.push({ path: [i, 'shifts', s.j, 'end'], message: 'End time must be after the start time' });
    }
    const ordered = shifts.filter((s) => s.to > s.from).sort((a, b) => a.from - b.from);
    for (let k = 1; k < ordered.length; k += 1) {
      if (ordered[k].from < ordered[k - 1].to) {
        problems.push({ path: [i, 'shifts', ordered[k].j, 'start'], message: 'This shift overlaps another one on the same day' });
      }
    }
  });
  return problems;
}

/** "06:00" → "6 am", "16:30" → "4:30 pm" */
export function formatClock(hhmm) {
  const minutes = toMinutes(hhmm);
  if (Number.isNaN(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** [1,2,3,5] → "Mon–Wed, Fri" (runs of 3+ days use a dash). */
function dayRuns(days) {
  const runs = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && last.to === d - 1) last.to = d;
    else runs.push({ from: d, to: d });
  }
  return runs
    .flatMap((r) =>
      r.to - r.from >= 2
        ? [`${WEEKDAY_SHORT[r.from]}–${WEEKDAY_SHORT[r.to]}`]
        : Array.from({ length: r.to - r.from + 1 }, (_, i) => WEEKDAY_SHORT[r.from + i])
    )
    .join(', ');
}

/**
 * One line a member or desk can read: "Mon–Fri 6 am–11 am, 4 pm–9 pm · Sat 6 am–11 am".
 * Days with the same shifts are grouped ("Mon, Wed, Fri 7 am–10 am"). Empty when there is no schedule.
 */
export function summarizeSchedule(schedule = []) {
  const groups = new Map();
  for (const d of normalizeSchedule(schedule)) {
    const key = d.shifts.map((s) => `${s.start}-${s.end}`).join(',');
    if (!groups.has(key)) groups.set(key, { days: [], shifts: d.shifts });
    groups.get(key).days.push(d.day);
  }
  return [...groups.values()]
    .map((g) => `${dayRuns(g.days)} ${g.shifts.map((s) => `${formatClock(s.start)}–${formatClock(s.end)}`).join(', ')}`)
    .join(' · ');
}

// ── Library ────────────────────────────────────────────────────────────────

/** Comparison key for exercise names: "Push-Up ", "push up" and "Push-up" are the same exercise. */
export function exerciseNameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
