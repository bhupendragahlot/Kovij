/**
 * Pure rules for automatic reminders: who gets which message on which gym day, and the key
 * that makes each send happen at most once. No database access here, so every rule is unit
 * tested directly (server/tests/engagement.test.js). services/reminderService.js feeds these
 * functions with data and delivers the results through notifyMember.
 *
 * Every calendar decision uses gym time (utils/time.js), never the server's clock zone.
 */
import { GYM_TZ, dayjs, gymDayKey, toGymTime } from '../utils/time.js';

/** Fixed policy (the owner-editable part lives in settings.reminders). */
export const REMINDER_POLICY = {
  /** Plans shorter than this (day passes, trials) get no expiry reminders. */
  minPlanDays: 7,
  /** Scheduled sends that missed the send hour (server asleep, restart) catch up until this hour. */
  latestHour: 21,
  /** A new due is left alone for this many days before the first reminder. */
  paymentDueFirstAfterDays: 1,
  /** Reminders per due; after that the desk follows up in person. */
  paymentDueMaxReminders: 6,
  /** A run that has held the lock longer than this is treated as crashed. */
  runLockMinutes: 15,
  maxDaysBefore: 60,
  maxDaysAfter: 90,
  maxDayOptions: 6,
};

/** Notification kinds created by the reminder engine, in the order they are shown. */
export const REMINDER_KINDS = ['expiry_reminder', 'expiry_today', 'come_back', 'payment_due', 'birthday'];

export const STAGE_KIND = {
  before: 'expiry_reminder',
  today: 'expiry_today',
  after: 'come_back',
  due: 'payment_due',
  birthday: 'birthday',
};

const DAY_MS = 86_400_000;

/** Whole days since the epoch for a `YYYY-MM-DD` key (calendar arithmetic, no clock zone involved). */
export function dayNumber(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Calendar days from one gym day key to another (negative when `toKey` is earlier). */
export const daysBetween = (fromKey, toKey) => dayNumber(toKey) - dayNumber(fromKey);

export const addDaysToKey = (dayKey, n) => new Date((dayNumber(dayKey) + n) * DAY_MS).toISOString().slice(0, 10);

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function dayList(list, max, fallback) {
  const source = Array.isArray(list) ? list : fallback;
  const clean = [...new Set(source.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))];
  return clean.sort((a, b) => a - b).slice(0, REMINDER_POLICY.maxDayOptions);
}

/** settings.reminders with defaults filled in, days de-duplicated and sorted, numbers clamped. */
export function normalizeReminderSettings(raw = {}) {
  const r = raw || {};
  return {
    enabled: r.enabled !== false,
    expiryDaysBefore: dayList(r.expiryDaysBefore, REMINDER_POLICY.maxDaysBefore, [7, 3, 1]),
    onExpiryDay: r.onExpiryDay !== false,
    afterExpiryDays: dayList(r.afterExpiryDays, REMINDER_POLICY.maxDaysAfter, [3, 7]),
    paymentDue: r.paymentDue !== false,
    paymentDueEveryDays: clampInt(r.paymentDueEveryDays, 1, 30, 3),
    birthday: r.birthday !== false,
    sendHour: clampInt(r.sendHour, 6, 21, 9),
  };
}

const isEnded = (m, now) => m.status === 'expired' || (m.status === 'active' && new Date(m.endDate) <= now);

/**
 * Which expiry stage (if any) a membership is in on the gym day of `now`.
 *   before: an active plan ends in exactly N days, N in expiryDaysBefore
 *   today:  the plan ends (or ended) today
 *   after:  the plan ended exactly N days ago, N in afterExpiryDays
 * A plan that started today never gets a "before"/"today" message (the member just bought it),
 * and short plans (day passes) get none at all.
 *
 * @returns {{ stage: 'before'|'today'|'after', days: number } | null}
 */
export function expiryStage(membership, now, settings, policy = REMINDER_POLICY) {
  const m = membership;
  if (!m?.endDate) return null;
  const today = gymDayKey(now);
  const endKey = gymDayKey(m.endDate);
  const startKey = m.startDate ? gymDayKey(m.startDate) : null;
  const length = Number(m.durationDays) || (startKey ? daysBetween(startKey, endKey) : 0);
  if (length < policy.minPlanDays) return null;

  const startedBeforeToday = startKey ? daysBetween(startKey, today) >= 1 : true;
  const d = daysBetween(today, endKey);

  if (d > 0) {
    return m.status === 'active' && startedBeforeToday && settings.expiryDaysBefore.includes(d) ? { stage: 'before', days: d } : null;
  }
  if (d === 0) {
    return settings.onExpiryDay && ['active', 'expired'].includes(m.status) && startedBeforeToday ? { stage: 'today', days: 0 } : null;
  }
  const ago = -d;
  return isEnded(m, now) && settings.afterExpiryDays.includes(ago) ? { stage: 'after', days: ago } : null;
}

const CURRENT = ['active', 'upcoming', 'pending', 'paused'];

/**
 * Why a member in an expiry stage should NOT get the message, or null to send.
 * `memberships` is every membership of that member (including `membership`).
 *   before/today: skipped when a renewal is queued or pending, or another plan runs longer
 *   after:        skipped when anything is current again, or a later plan exists
 */
export function expirySkipReason(stage, membership, memberships = []) {
  const id = String(membership._id);
  const end = new Date(membership.endDate).getTime();
  const others = memberships.filter((o) => String(o._id) !== id);
  if (stage === 'before' || stage === 'today') {
    if (others.some((o) => o.status === 'upcoming' || o.status === 'pending')) return 'renewed';
    if (others.some((o) => o.status === 'active' && new Date(o.endDate).getTime() > end)) return 'renewed';
    return null;
  }
  if (others.some((o) => CURRENT.includes(o.status))) return 'renewed';
  if (others.some((o) => o.status !== 'cancelled' && new Date(o.endDate).getTime() > end)) return 'newer_plan';
  return null;
}

/** One key per membership and stage: `expiry:<id>:7d`, `expiry:<id>:0d`, `expired:<id>:3d`. */
export function expiryDedupeKey(stage, membershipId, days) {
  if (stage === 'after') return `expired:${membershipId}:${days}d`;
  return `expiry:${membershipId}:${stage === 'today' ? 0 : days}d`;
}

/**
 * Payment-due timing for one member, anchored on their newest pending due. Reminders go out
 * from day 1 after the due was created, then every `everyDays`, at most `paymentDueMaxReminders`
 * times. `lastSentDay` (gym day of the member's previous payment reminder) keeps the spacing
 * even after the owner changes `everyDays`.
 *
 * `sent_today` means today's reminder already went out (shown as "already sent", never repeated).
 *
 * @returns {{ send: boolean, bucket?: number, reason?: 'too_new'|'max_reached'|'sent_today'|'too_soon' }}
 */
export function paymentDueDecision({ anchorCreatedAt, lastSentDay, now, everyDays, policy = REMINDER_POLICY }) {
  const today = gymDayKey(now);
  const age = daysBetween(gymDayKey(anchorCreatedAt), today);
  if (age < policy.paymentDueFirstAfterDays) return { send: false, reason: 'too_new' };
  const bucket = Math.floor((age - policy.paymentDueFirstAfterDays) / everyDays);
  const gap = lastSentDay ? daysBetween(lastSentDay, today) : null;
  if (gap === 0) return { send: false, reason: 'sent_today', bucket };
  if (bucket >= policy.paymentDueMaxReminders) return { send: false, reason: 'max_reached', bucket };
  if (gap != null && gap < everyDays) return { send: false, reason: 'too_soon', bucket };
  return { send: true, bucket };
}

/** `due:<paymentId>:<everyDays>d:<bucket>`: the spacing is part of the key so a settings change never collides. */
export const paymentDueKey = (paymentId, everyDays, bucket) => `due:${paymentId}:${everyDays}d:${bucket}`;

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Birthday on the gym day of `now`, read in gym time. 29 Feb birthdays are wished on 28 Feb in other years. */
export function isBirthdayToday(dob, now) {
  if (!dob) return false;
  const b = toGymTime(dob);
  if (!b.isValid()) return false;
  const t = toGymTime(now);
  if (b.month() === t.month() && b.date() === t.date()) return true;
  return b.month() === 1 && b.date() === 29 && t.month() === 1 && t.date() === 28 && !isLeapYear(t.year());
}

/** (month 1–12, day) pairs whose birthdays fall on the gym day of `now` (for a database query). */
export function birthdayMonthDays(now) {
  const t = toGymTime(now);
  const pairs = [{ month: t.month() + 1, day: t.date() }];
  if (t.month() === 1 && t.date() === 28 && !isLeapYear(t.year())) pairs.push({ month: 2, day: 29 });
  return pairs;
}

/** Once per member per gym year. */
export const birthdayKey = (memberId, now) => `birthday:${memberId}:${toGymTime(now).year()}`;

/**
 * Should the hourly tick run today's scheduled reminders now? Runs at the send hour, or later
 * the same day if that hour was missed, but never after `latestHour` and only once a day.
 */
export function scheduledRunDecision({ now, settings, doneToday, policy = REMINDER_POLICY }) {
  if (!settings.enabled) return { run: false, reason: 'disabled' };
  if (doneToday) return { run: false, reason: 'done_today' };
  const hour = toGymTime(now).hour();
  if (hour < settings.sendHour) return { run: false, reason: 'before_send_hour' };
  if (hour > policy.latestHour) return { run: false, reason: 'too_late' };
  return { run: true };
}

/** When the next scheduled run will happen (null when reminders are off). */
export function nextScheduledRun({ now, settings, doneToday, policy = REMINDER_POLICY }) {
  if (!settings.enabled) return null;
  const t = toGymTime(now);
  const atSendHour = (day) => dayjs.tz(`${day} ${String(settings.sendHour).padStart(2, '0')}:05`, GYM_TZ).toDate();
  const today = gymDayKey(now);
  if (doneToday || t.hour() > policy.latestHour) return atSendHour(addDaysToKey(today, 1));
  if (t.hour() < settings.sendHour) return atSendHour(today);
  // Due now: the next hourly tick picks it up.
  return t.add(1, 'hour').startOf('hour').add(5, 'minute').toDate();
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatAmount = (n) => inr.format(Number(n) || 0);
export const formatDay = (value) => (value ? toGymTime(value).format('D MMM YYYY') : '');
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

/** Member-app paths each message opens. */
export const REMINDER_LINKS = {
  expiry_reminder: '/member/membership',
  expiry_today: '/member/membership',
  come_back: '/member/membership',
  payment_due: '/member/payments',
  birthday: '/member/dashboard',
};

export const REMINDER_TEMPLATES = {
  expiry_reminder: 'reminderExpirySoon',
  expiry_today: 'reminderExpiryToday',
  come_back: 'reminderComeBack',
  payment_due: 'reminderPaymentDue',
  birthday: 'birthdayWish',
};

/**
 * In-app / push wording for one reminder. Short and plain: it is read on a lock screen.
 * @param {'before'|'today'|'after'|'due'|'birthday'} stage
 */
export function reminderMessage(stage, { gymName = 'the gym', memberName, planName, endDate, days, amount } = {}) {
  const kind = STAGE_KIND[stage];
  const plan = planName || 'membership';
  let title;
  let body;
  if (stage === 'before') {
    title = days === 1 ? 'Your plan ends tomorrow' : `Your plan ends in ${days} days`;
    body = `Your ${plan} plan at ${gymName} ends on ${formatDay(endDate)}. Renew now to keep training without a break.`;
  } else if (stage === 'today') {
    title = 'Your plan ends today';
    body = `Your ${plan} plan ends today, ${formatDay(endDate)}. Renew in the app or at the front desk to keep checking in.`;
  } else if (stage === 'after') {
    title = `We miss you at ${gymName}`;
    body = `Your ${plan} plan ended on ${formatDay(endDate)}. Renew in the app or at the front desk and pick up where you left off.`;
  } else if (stage === 'due') {
    title = `Payment due: ${formatAmount(amount)}`;
    body = `You have ${formatAmount(amount)} due at ${gymName}. Pay at the front desk or in the app.`;
  } else if (stage === 'birthday') {
    title = `Happy birthday, ${firstName(memberName)}!`;
    body = `Everyone at ${gymName} wishes you a great year ahead. Enjoy your workout today!`;
  } else {
    throw new Error(`Unknown reminder stage "${stage}"`);
  }
  return { kind, title, body, link: REMINDER_LINKS[kind], templateKey: REMINDER_TEMPLATES[kind], preference: stage === 'birthday' ? 'birthday' : null };
}
