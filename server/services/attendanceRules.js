/**
 * Attendance rules with no database access: who may enter, what a scan does, visit status,
 * streaks, calendar helpers and CSV. attendanceService.js applies them; unit tests cover them.
 *
 * Day keys are gym-local calendar days ("YYYY-MM-DD", see utils/time.js). Stepping between
 * them is plain calendar arithmetic, so it is done on the key itself and never on server-local
 * midnights.
 */
import { gymDayKey, toGymTime } from '../utils/time.js';

/** Every tunable in one place. */
export const ATTENDANCE_POLICY = {
  /** At a scanner in "auto" mode, a second scan this long after entry checks the member out. */
  autoCheckOutAfterMinutes: 20,
  /** A visit still open this long after the gym's last session ends shows as "no check-out". */
  closingGraceMinutes: 30,
  /** Kiosk and desk nudge a renewal when the plan ends within this many days. */
  endingSoonDays: 3,
  /** How far back streaks look. */
  streakLookbackDays: 400,
  /** Months shown in a member's "visits per month" trend. */
  trendMonths: 12,
};

const DAY_MS = 86_400_000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

// ── Calendar keys ──────────────────────────────────────────────────────────

const keyToUtc = (key) => {
  const [, y, m, d] = DAY_KEY.exec(key);
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
};
const utcToKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** True for a real calendar day ("2026-02-30" is not). */
export function isValidDayKey(key) {
  return typeof key === 'string' && DAY_KEY.test(key) && utcToKey(keyToUtc(key)) === key;
}

export function isValidMonthKey(key) {
  if (typeof key !== 'string' || !MONTH_KEY.test(key)) return false;
  const month = Number(key.slice(5, 7));
  return month >= 1 && month <= 12;
}

export const addDaysToKey = (key, days) => utcToKey(keyToUtc(key) + days * DAY_MS);

/** 0 = Sunday … 6 = Saturday, for the calendar day itself (matches Settings.openingHours). */
export const weekdayOfKey = (key) => new Date(keyToUtc(key)).getUTCDay();

/** Whole calendar days from `a` to `b` (both day keys). */
export const daysBetweenKeys = (a, b) => Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);

export const monthOfKey = (key) => key.slice(0, 7);
export const currentGymMonth = (now = new Date()) => monthOfKey(gymDayKey(now));

/** Every day key of a month ("YYYY-MM"). */
export function monthDays(month) {
  const [, y, m] = MONTH_KEY.exec(month);
  const count = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

/** `count` month keys ending with `month`, oldest first. */
export function monthsEndingAt(month, count) {
  const [, y, m] = MONTH_KEY.exec(month);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(Number(y), Number(m) - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

// ── Opening hours ──────────────────────────────────────────────────────────

const toMinutes = (hhmm) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : null;
};

/** Minute of the day the gym's last session ends on `weekday`, or null when unknown or closed. */
export function closingMinute(openingHours, weekday) {
  const entry = (openingHours || []).find((d) => d.day === weekday);
  if (!entry || entry.closed) return null;
  let last = null;
  for (const slot of entry.slots || []) {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    // Sessions that run past midnight are not modelled; ignore them rather than guess.
    if (open == null || close == null || close <= open) continue;
    last = last == null ? close : Math.max(last, close);
  }
  return last;
}

/** Has the gym closed for the day (last session end + grace)? False when hours are unknown. */
export function isPastClosing(now, openingHours, graceMinutes = ATTENDANCE_POLICY.closingGraceMinutes) {
  const t = toGymTime(now);
  const close = closingMinute(openingHours, t.day());
  if (close == null) return false;
  return t.hour() * 60 + t.minute() >= close + graceMinutes;
}

export const holidayOn = (dayKey, holidays) => (holidays || []).find((h) => h.date === dayKey) || null;

/** Is the gym normally open on this day? Unknown hours count as open. */
export function isOpenDay(dayKey, { openingHours, holidays } = {}) {
  if (holidayOn(dayKey, holidays)) return false;
  const entry = (openingHours || []).find((d) => d.day === weekdayOfKey(dayKey));
  return !entry?.closed;
}

// ── Membership standing at the door ────────────────────────────────────────

const formatDay = (date) => toGymTime(date).format('D MMM YYYY');

/** Whole gym days from `now` until `date`: 0 on the day itself, negative once past. */
export function gymDaysUntil(date, now = new Date()) {
  if (!date) return null;
  return daysBetweenKeys(gymDayKey(now), gymDayKey(date));
}

/** When a paused plan starts again (contract with membershipService.currentMembershipState). */
export const pauseEndsAt = (membership) => membership?.pauseEndsAt ?? membership?.freeze?.endDate ?? null;

/** The plan facts the desk and kiosk show next to a member. */
export function membershipSummary({ state, membership }, now = new Date()) {
  if (!membership) return { state };
  return {
    state,
    planName: membership.planName || '',
    startDate: membership.startDate || null,
    endDate: membership.endDate || null,
    daysLeft: gymDaysUntil(membership.endDate, now),
    ...(state === 'paused' && { pausedUntil: pauseEndsAt(membership) }),
  };
}

/**
 * May this member walk in? Same rules at the desk, the desk scanner and the kiosk; only the desk
 * may let someone in anyway (with a reason).
 *
 * @returns {{ allowed: boolean, reason?: string, message?: string }}
 *   reason: short line for badges and the kiosk ("Plan ended on 3 Sep 2026")
 *   message: full sentence for the desk ("Priya's plan ended on 3 Sep 2026")
 */
export function evaluateEntry({ name, memberActive = true, standing }) {
  const who = name || 'This member';
  if (memberActive === false) {
    return { allowed: false, reason: 'Profile turned off', message: `${who}'s profile is turned off` };
  }
  const { state, membership } = standing || { state: 'none' };
  switch (state) {
    case 'active':
      return { allowed: true };
    case 'paused': {
      const resumes = pauseEndsAt(membership);
      // The freeze ends at the start of the day the plan resumes; the last day on hold is the day before.
      const until = resumes ? formatDay(new Date(new Date(resumes).getTime() - 1)) : null;
      return {
        allowed: false,
        reason: until ? `On hold until ${until}` : 'On hold',
        message: until ? `${who}'s plan is on hold until ${until}` : `${who}'s plan is on hold`,
      };
    }
    case 'pending':
      return { allowed: false, reason: 'Waiting for payment', message: `${who}'s registration is waiting for payment` };
    case 'upcoming': {
      const starts = membership?.startDate ? formatDay(membership.startDate) : null;
      return {
        allowed: false,
        reason: starts ? `Plan starts on ${starts}` : 'Plan has not started',
        message: starts ? `${who}'s plan starts on ${starts}` : `${who}'s plan has not started yet`,
      };
    }
    case 'expired': {
      const ended = membership?.endDate ? formatDay(membership.endDate) : null;
      return {
        allowed: false,
        reason: ended ? `Plan ended on ${ended}` : 'Plan ended',
        message: ended ? `${who}'s plan ended on ${ended}` : `${who}'s plan has ended`,
      };
    }
    default:
      return { allowed: false, reason: 'No plan', message: `${who} has no plan yet` };
  }
}

/** Membership state as stored on the visit. */
export const storedMembershipStatus = (state) =>
  ['active', 'expired', 'pending', 'upcoming', 'paused'].includes(state) ? state : 'none';

// ── Visits ─────────────────────────────────────────────────────────────────

export const minutesBetween = (from, to) => Math.max(0, Math.round((new Date(to) - new Date(from)) / 60_000));

/** Start of the stretch that is open now (older rows have no lastInAt). */
export const openStretchStart = (visit) => visit.lastInAt || visit.checkedInAt;

/**
 * What a scan does, given today's visit (or null).
 *   mode "in":   check in, or reopen after a check-out
 *   mode "out":  check out
 *   mode "auto": check in; a scan at least `autoCheckOutAfterMinutes` later checks out;
 *                a scan after checking out is a return
 * @returns {'check_in'|'return'|'check_out'|'already_in'|'already_out'|'not_in'}
 */
export function decideScanAction(visit, { mode = 'auto', now = new Date(), policy = ATTENDANCE_POLICY } = {}) {
  if (!visit) return mode === 'out' ? 'not_in' : 'check_in';
  const open = !visit.checkedOutAt;
  if (mode === 'in') return open ? 'already_in' : 'return';
  if (mode === 'out') return open ? 'check_out' : 'already_out';
  if (!open) return 'return';
  return minutesBetween(openStretchStart(visit), now) >= policy.autoCheckOutAfterMinutes ? 'check_out' : 'already_in';
}

/**
 * "in" (in the gym now), "out" (checked out) or "no_check_out" (left open on an earlier day, or
 * after closing today). A missing check-out is shown as missing, never guessed.
 */
export function visitStatus(visit, { todayKey, pastClosing = false }) {
  if (visit.checkedOutAt) return 'out';
  if (visit.dayKey !== todayKey || pastClosing) return 'no_check_out';
  return 'in';
}

/** Minutes in the gym for a checked-out visit; null while it is open or has no check-out. */
export const visitMinutes = (visit) => (visit.checkedOutAt ? Math.max(0, Math.round(visit.minutesInGym || 0)) : null);

// ── Streaks ────────────────────────────────────────────────────────────────

/**
 * Consecutive open days with a visit, ending today. Days the gym is closed (holidays, Sundays)
 * never break a streak, and today only counts once the member has come in: a streak isn't lost
 * until the day is over.
 *
 * @param {Set<string>} visited  day keys with a visit
 * @param {{ todayKey: string, isOpen: (key: string) => boolean, lookbackDays?: number }} ctx
 */
export function computeStreak(visited, { todayKey, isOpen = () => true, lookbackDays = ATTENDANCE_POLICY.streakLookbackDays }) {
  const counts = (key, isToday) => (visited.has(key) ? 'visit' : isToday || !isOpen(key) ? 'skip' : 'miss');

  let current = 0;
  for (let i = 0; i < lookbackDays; i++) {
    const outcome = counts(addDaysToKey(todayKey, -i), i === 0);
    if (outcome === 'visit') current += 1;
    else if (outcome === 'miss') break;
  }

  let longest = 0;
  let run = 0;
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const outcome = counts(addDaysToKey(todayKey, -i), i === 0);
    if (outcome === 'visit') longest = Math.max(longest, ++run);
    else if (outcome === 'miss') run = 0;
  }
  return { current, longest: Math.max(longest, current) };
}

// ── Charts ─────────────────────────────────────────────────────────────────

/** Aggregate rows [{ _id: hour, n }] → 24 hourly buckets. */
export function hourBuckets(rows, divisor = 1) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const r of rows) if (hours[r._id]) hours[r._id].count = Math.round((r.n / divisor) * 10) / 10;
  return hours;
}

// ── CSV ────────────────────────────────────────────────────────────────────

/**
 * One CSV cell. Text that a spreadsheet would run as a formula (=, +, -, @) is prefixed with
 * an apostrophe, so a member named "=HYPERLINK(...)" stays plain text.
 */
export function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 byte-order mark so Excel shows Hindi names correctly. */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
