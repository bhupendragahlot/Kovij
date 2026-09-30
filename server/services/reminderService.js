/**
 * Automatic reminders: membership expiry (before, on the day, "come back" after), payment due
 * and birthday wishes. The pure rules live in reminderRules.js; this module loads the data,
 * applies them, and delivers through notifyMember (via memberNotifier) with a dedupeKey per
 * send, so overlapping runs, restarts and "Send now" never message anyone twice.
 *
 *   previewReminders(now)          who gets what on that day (no sends, no writes)
 *   runReminders(now, { trigger }) housekeeping + sends, recorded as a ReminderRun
 *   runScheduledReminders(now)     the hourly tick: runs once a day at/after the send hour
 */
import PQueue from 'p-queue';
import Membership from '../models/Membership.js';
import Member from '../models/Member.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import ReminderRun from '../models/ReminderRun.js';
import Settings, { getSettingsDoc } from '../models/Settings.js';
import { rollOverMemberships } from './membershipService.js';
import { paymentTypeLabel } from './receiptService.js';
import { appLink, gymContact, sendToMember } from './memberNotifier.js';
import { isEmailConfigured } from './emailService.js';
import { isPushConfigured } from './pushChannel.js';
import * as rules from './reminderRules.js';
import { AppError } from '../middleware/errorHandler.js';
import { GYM_TZ, gymDayKey, parseGymDay, startOfGymDay } from '../utils/time.js';
import { toObjectId } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const MEMBER_FIELDS = 'name email memberCode isActive notificationPrefs';
const STAGE_ORDER = { before: 0, today: 1, after: 2, due: 3, birthday: 4 };

const dayStart = (key) => parseGymDay(key).toDate();
const dayEnd = (key) => parseGymDay(key).endOf('day').toDate();
const scopeFilter = (memberIds) => (memberIds ? { $in: memberIds.map(toObjectId) } : undefined);

/** Collects sends and skips while the collectors run. */
function createPlan(now, settingsDoc) {
  const settings = rules.normalizeReminderSettings(settingsDoc.reminders);
  const base = { gymName: settingsDoc.gymName || 'Kovij Fitness Zone', contact: gymContact(settingsDoc) };
  const forDate = startOfGymDay(now);
  const plan = { now, today: gymDayKey(now), settings, sends: [], skipped: [] };

  plan.skip = (stage, member, reason) =>
    plan.skipped.push({ stage, kind: rules.STAGE_KIND[stage], memberId: member?._id, memberName: member?.name || '', reason });

  /** `alreadySent`: known to have gone out today by another route (never delivered again). */
  plan.add = ({ stage, member, dedupeKey, messageInput, emailVars, meta, detail, alreadySent = false }) => {
    const msg = rules.reminderMessage(stage, { gymName: base.gymName, memberName: member.name, ...messageInput });
    plan.sends.push({
      stage,
      kind: msg.kind,
      dedupeKey,
      alreadySent,
      member,
      title: msg.title,
      body: msg.body,
      detail,
      notify: {
        memberId: member._id,
        kind: msg.kind,
        title: msg.title,
        body: msg.body,
        link: msg.link,
        preference: msg.preference,
        dedupeKey,
        email: { templateKey: msg.templateKey, vars: { ...base, ...emailVars, ctaUrl: appLink(msg.link) } },
        meta: { stage, forDate, emailTemplate: msg.templateKey, ...meta },
      },
    });
  };
  return plan;
}

async function collectExpiry(plan, memberIds) {
  const { now, today, settings } = plan;
  const maxBefore = Math.max(0, ...settings.expiryDaysBefore);
  const maxAfter = Math.max(0, ...settings.afterExpiryDays);
  if (!maxBefore && !settings.onExpiryDay && !maxAfter) return;

  const filter = {
    status: { $in: ['active', 'expired'] },
    endDate: { $gte: dayStart(rules.addDaysToKey(today, -maxAfter)), $lte: dayEnd(rules.addDaysToKey(today, maxBefore)) },
  };
  if (memberIds) filter.memberId = scopeFilter(memberIds);
  const candidates = await Membership.find(filter)
    .select('memberId planId planName price durationDays startDate endDate status lastReminderSentAt')
    .lean();
  const staged = candidates.map((m) => ({ m, s: rules.expiryStage(m, now, settings) })).filter((x) => x.s);
  if (!staged.length) return;

  // One expiry message per member per day: the plan that ends last is the one that matters.
  const best = new Map();
  for (const x of staged) {
    const key = String(x.m.memberId);
    const prev = best.get(key);
    if (!prev || new Date(x.m.endDate) > new Date(prev.m.endDate)) best.set(key, x);
  }
  const ids = [...best.keys()].map(toObjectId);
  const [all, members, plans] = await Promise.all([
    Membership.find({ memberId: { $in: ids } }).select('memberId status startDate endDate').lean(),
    Member.find({ _id: { $in: ids } }).select(MEMBER_FIELDS).lean(),
    Plan.find({ _id: { $in: [...new Set([...best.values()].map((x) => String(x.m.planId)))].map(toObjectId) } }).select('price status').lean(),
  ]);
  const byMember = new Map();
  for (const m of all) {
    const key = String(m.memberId);
    if (!byMember.has(key)) byMember.set(key, []);
    byMember.get(key).push(m);
  }
  const memberById = new Map(members.map((m) => [String(m._id), m]));
  const planById = new Map(plans.map((p) => [String(p._id), p]));

  for (const { m, s } of best.values()) {
    const member = memberById.get(String(m.memberId));
    if (!member || member.isActive === false) {
      plan.skip(s.stage, member || { _id: m.memberId }, 'inactive');
      continue;
    }
    const reason = rules.expirySkipReason(s.stage, m, byMember.get(String(m.memberId)) || []);
    if (reason) {
      plan.skip(s.stage, member, reason);
      continue;
    }
    // The previous reminder job stamped this when it emailed; don't repeat on the day of the switch-over.
    if (s.stage === 'before' && m.lastReminderSentAt && gymDayKey(m.lastReminderSentAt) === today) {
      plan.skip(s.stage, member, 'already_reminded');
      continue;
    }
    const current = planById.get(String(m.planId));
    const renewPrice = current && current.status !== 'Inactive' ? current.price : m.price;
    plan.add({
      stage: s.stage,
      member,
      dedupeKey: rules.expiryDedupeKey(s.stage, m._id, s.days),
      messageInput: { planName: m.planName, endDate: m.endDate, days: s.days },
      emailVars: { planName: m.planName, endDate: m.endDate, days: s.days, renewPrice },
      meta: { membershipId: m._id, days: s.days },
      detail: { planName: m.planName, endDate: m.endDate, days: s.days, amount: renewPrice },
    });
  }
}

async function collectDues(plan, memberIds) {
  const { now, settings } = plan;
  const filter = { status: 'pending', amount: { $gt: 0 } };
  if (memberIds) filter.memberId = scopeFilter(memberIds);
  const pending = await Payment.find(filter).select('memberId membershipId amount type createdAt').lean();
  if (!pending.length) return;

  // Dues on a cancelled plan are the desk's to settle, not something to chase automatically.
  const membershipIds = [...new Set(pending.filter((p) => p.membershipId).map((p) => String(p.membershipId)))];
  const cancelled = new Set(
    (await Membership.find({ _id: { $in: membershipIds.map(toObjectId) }, status: 'cancelled' }).select('_id').lean()).map((m) => String(m._id))
  );

  const groups = new Map();
  for (const p of pending) {
    if (p.membershipId && cancelled.has(String(p.membershipId))) continue;
    const key = String(p.memberId);
    const g = groups.get(key) || { memberId: p.memberId, total: 0, items: [], anchor: null };
    g.total += Number(p.amount) || 0;
    g.items.push({ label: paymentTypeLabel(p.type), amount: p.amount });
    // Anchor on the newest due: a new charge restarts the reminder cycle.
    if (!g.anchor || new Date(p.createdAt) > new Date(g.anchor.createdAt)) g.anchor = p;
    groups.set(key, g);
  }
  if (!groups.size) return;

  const ids = [...groups.values()].map((g) => g.memberId);
  const [members, lastSent] = await Promise.all([
    Member.find({ _id: { $in: ids } }).select(MEMBER_FIELDS).lean(),
    Notification.aggregate([
      { $match: { kind: 'payment_due', memberId: { $in: ids } } },
      { $group: { _id: '$memberId', last: { $max: '$meta.forDate' } } },
    ]),
  ]);
  const memberById = new Map(members.map((m) => [String(m._id), m]));
  const lastById = new Map(lastSent.map((r) => [String(r._id), r.last]));

  for (const g of groups.values()) {
    const member = memberById.get(String(g.memberId));
    if (!member || member.isActive === false) {
      plan.skip('due', member || { _id: g.memberId }, 'inactive');
      continue;
    }
    const last = lastById.get(String(g.memberId));
    const decision = rules.paymentDueDecision({
      anchorCreatedAt: g.anchor.createdAt,
      lastSentDay: last ? gymDayKey(last) : null,
      now,
      everyDays: settings.paymentDueEveryDays,
    });
    const sentToday = decision.reason === 'sent_today';
    if (!decision.send && !sentToday) {
      if (decision.reason !== 'too_new') plan.skip('due', member, decision.reason);
      continue;
    }
    plan.add({
      stage: 'due',
      member,
      dedupeKey: rules.paymentDueKey(g.anchor._id, settings.paymentDueEveryDays, decision.bucket),
      alreadySent: sentToday,
      messageInput: { amount: g.total },
      emailVars: { amount: g.total, items: g.items },
      meta: { paymentId: g.anchor._id, amount: g.total, reminderNo: decision.bucket + 1 },
      detail: { amount: g.total, reminderNo: decision.bucket + 1 },
    });
  }
}

async function collectBirthdays(plan, memberIds) {
  const { now } = plan;
  const pairs = rules.birthdayMonthDays(now);
  const filter = {
    isActive: { $ne: false },
    dob: { $type: 'date' },
    $expr: {
      $or: pairs.map(({ month, day }) => ({
        $and: [
          { $eq: [{ $month: { date: '$dob', timezone: GYM_TZ } }, month] },
          { $eq: [{ $dayOfMonth: { date: '$dob', timezone: GYM_TZ } }, day] },
        ],
      })),
    },
  };
  if (memberIds) filter._id = scopeFilter(memberIds);
  const members = await Member.find(filter).select(`${MEMBER_FIELDS} dob`).lean();
  if (!members.length) return;

  // Wishes go to people who have trained here, not to app sign-ups who never joined.
  const joined = new Set(
    (
      await Membership.distinct('memberId', {
        memberId: { $in: members.map((m) => m._id) },
        status: { $in: ['active', 'upcoming', 'paused', 'expired'] },
      })
    ).map(String)
  );
  for (const member of members) {
    if (!rules.isBirthdayToday(member.dob, now)) continue;
    if (!joined.has(String(member._id))) {
      plan.skip('birthday', member, 'never_joined');
      continue;
    }
    // Opting out of birthday wishes means no message at all, not just no email.
    if (member.notificationPrefs?.birthday === false) {
      plan.skip('birthday', member, 'opted_out');
      continue;
    }
    plan.add({
      stage: 'birthday',
      member,
      dedupeKey: rules.birthdayKey(member._id, now),
      messageInput: {},
      emailVars: {},
      meta: {},
      detail: {},
    });
  }
}

/**
 * Everything that would be sent on the gym day of `now`.
 * @param {{ memberIds?: string[] }} [scope] limit to these members (tests only)
 */
export async function collectReminders(now = new Date(), settingsDoc, { memberIds } = {}) {
  const doc = settingsDoc || (await getSettingsDoc());
  const plan = createPlan(now, doc);
  const s = plan.settings;
  if (s.expiryDaysBefore.length || s.onExpiryDay || s.afterExpiryDays.length) await collectExpiry(plan, memberIds);
  if (s.paymentDue) await collectDues(plan, memberIds);
  if (s.birthday) await collectBirthdays(plan, memberIds);
  plan.sends.sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.member.name.localeCompare(b.member.name));
  return plan;
}

const countBy = (list, key) => list.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] || 0) + 1), acc), {});

/** Dry run for the admin screen: who gets what, and whether it already went out. Writes nothing. */
export async function previewReminders(now = new Date(), { memberIds } = {}) {
  const settingsDoc = await getSettingsDoc();
  const plan = await collectReminders(now, settingsDoc, { memberIds });
  const keys = plan.sends.map((s) => s.dedupeKey);
  const ids = [...new Set(plan.sends.map((s) => String(s.member._id)))].map(toObjectId);
  const [sent, devices] = await Promise.all([
    keys.length ? Notification.find({ dedupeKey: { $in: keys } }).select('dedupeKey').lean() : [],
    ids.length && isPushConfigured()
      ? PushSubscription.aggregate([{ $match: { memberId: { $in: ids } } }, { $group: { _id: '$memberId', n: { $sum: 1 } } }])
      : [],
  ]);
  const sentKeys = new Set(sent.map((n) => n.dedupeKey));
  const deviceCount = new Map(devices.map((d) => [String(d._id), d.n]));

  const items = plan.sends.map((s) => {
    const prefs = s.member.notificationPrefs || {};
    return {
      stage: s.stage,
      kind: s.kind,
      member: { _id: s.member._id, name: s.member.name, memberCode: s.member.memberCode || '' },
      title: s.title,
      body: s.body,
      detail: s.detail,
      status: s.alreadySent || sentKeys.has(s.dedupeKey) ? 'already_sent' : 'will_send',
      channels: {
        email: Boolean(s.member.email) && prefs.email !== false,
        push: isPushConfigured() && prefs.push !== false && (deviceCount.get(String(s.member._id)) || 0) > 0,
      },
    };
  });

  return {
    date: plan.today,
    enabled: plan.settings.enabled,
    settings: plan.settings,
    items,
    counts: {
      byKind: countBy(items, 'kind'),
      willSend: items.filter((i) => i.status === 'will_send').length,
      alreadySent: items.filter((i) => i.status === 'already_sent').length,
    },
    skipped: plan.skipped.slice(0, 200).map((x) => ({ kind: x.kind, reason: x.reason, member: { _id: x.memberId, name: x.memberName } })),
    skippedByReason: countBy(plan.skipped, 'reason'),
  };
}

async function acquireRunLock(now, trigger, staffId) {
  const staleBefore = new Date(Date.now() - rules.REMINDER_POLICY.runLockMinutes * 60_000);
  await ReminderRun.updateMany(
    { lock: 'reminders', startedAt: { $lt: staleBefore } },
    { $set: { status: 'failed', error: 'Stopped before finishing', finishedAt: new Date() }, $unset: { lock: 1 } }
  );
  try {
    return await ReminderRun.create({ dayKey: gymDayKey(now), trigger, lock: 'reminders', status: 'running', startedAt: new Date(), asOf: now, triggeredBy: staffId });
  } catch (e) {
    if (e?.code === 11000) return null;
    throw e;
  }
}

/**
 * Housekeeping, then every reminder due today. Safe to repeat: already-sent messages are
 * counted as `alreadySent`, never delivered again.
 *
 * @param {{ trigger?: 'schedule'|'manual'|'test', staffId?: string, housekeeping?: boolean, memberIds?: string[] }} [opts]
 * @returns {Promise<object|null>} run summary; null when the scheduled run found reminders off or another run going
 */
export async function runReminders(now = new Date(), { trigger = 'schedule', staffId, housekeeping = true, memberIds } = {}) {
  const settingsDoc = await getSettingsDoc();
  const settings = rules.normalizeReminderSettings(settingsDoc.reminders);
  if (!settings.enabled) {
    if (trigger === 'schedule') return null;
    throw new AppError('Automatic reminders are turned off. Turn them on in Settings, Reminders first.', 409, 'REMINDERS_OFF');
  }

  const run = await acquireRunLock(now, trigger, staffId);
  if (!run) {
    if (trigger === 'schedule') return null;
    throw new AppError('Reminders are already going out. Check the history in a minute.', 409, 'REMINDERS_RUNNING');
  }

  try {
    const rolled = housekeeping ? await rollOverMemberships(now) : { expired: 0, started: 0 };
    const plan = await collectReminders(now, settingsDoc, { memberIds });
    const byKind = {};
    const totals = { sent: 0, alreadySent: 0, failed: 0, skipped: plan.skipped.length };
    const queue = new PQueue({ concurrency: 4 });
    await Promise.all(
      plan.sends.map((s) =>
        queue.add(async () => {
          const bucket = (byKind[s.kind] ||= { sent: 0, alreadySent: 0, failed: 0 });
          if (s.alreadySent) {
            bucket.alreadySent += 1;
            totals.alreadySent += 1;
            return;
          }
          try {
            const { created } = await sendToMember(s.notify);
            bucket[created ? 'sent' : 'alreadySent'] += 1;
            totals[created ? 'sent' : 'alreadySent'] += 1;
          } catch (e) {
            bucket.failed += 1;
            totals.failed += 1;
            logger.error(`Reminder ${s.dedupeKey} failed: ${e.message}`);
          }
        })
      )
    );
    const finishedAt = new Date();
    await ReminderRun.updateOne(
      { _id: run._id },
      { $set: { status: 'done', finishedAt, byKind, totals, housekeeping: rolled }, $unset: { lock: 1 } }
    );
    logger.info(`Reminders (${trigger}) for ${plan.today}: ${totals.sent} sent, ${totals.alreadySent} already sent, ${totals.failed} failed`);
    return { _id: run._id, dayKey: plan.today, trigger, status: 'done', startedAt: run.startedAt, finishedAt, byKind, totals, housekeeping: rolled };
  } catch (e) {
    await ReminderRun.updateOne(
      { _id: run._id },
      { $set: { status: 'failed', finishedAt: new Date(), error: String(e.message).slice(0, 300) }, $unset: { lock: 1 } }
    );
    throw e;
  }
}

/** Hourly tick: send today's reminders once, at or after the owner's send hour. */
export async function runScheduledReminders(now = new Date()) {
  const settingsDoc = await getSettingsDoc();
  const settings = rules.normalizeReminderSettings(settingsDoc.reminders);
  const doneToday = await ReminderRun.exists({ dayKey: gymDayKey(now), trigger: 'schedule', status: 'done' });
  const decision = rules.scheduledRunDecision({ now, settings, doneToday: Boolean(doneToday) });
  if (!decision.run) return { ran: false, reason: decision.reason };
  const summary = await runReminders(now, { trigger: 'schedule' });
  return { ran: Boolean(summary), summary };
}

/** Status for the admin screen: settings, last run, next run, and whether email/push can deliver. */
export async function reminderOverview(now = new Date()) {
  const settingsDoc = await getSettingsDoc();
  const settings = rules.normalizeReminderSettings(settingsDoc.reminders);
  const [lastRun, doneToday, running] = await Promise.all([
    ReminderRun.findOne({ status: { $ne: 'running' }, trigger: { $ne: 'test' } }).sort({ startedAt: -1 }).populate('triggeredBy', 'name').lean(),
    ReminderRun.exists({ dayKey: gymDayKey(now), trigger: 'schedule', status: 'done' }),
    ReminderRun.exists({ lock: 'reminders' }),
  ]);
  return {
    today: gymDayKey(now),
    settings,
    lastRun,
    running: Boolean(running),
    doneToday: Boolean(doneToday),
    nextRunAt: rules.nextScheduledRun({ now, settings, doneToday: Boolean(doneToday) }),
    scheduler: process.env.ENABLE_CRON !== 'false',
    channels: { email: isEmailConfigured(), push: isPushConfigured() },
  };
}

/** Per-kind counts of reminders created in the last `days` gym days. */
export async function reminderStats(days = 30, now = new Date()) {
  const since = dayStart(rules.addDaysToKey(gymDayKey(now), -(days - 1)));
  const is = (path, values) => ({ $sum: { $cond: [{ $in: [path, values] }, 1, 0] } });
  const rows = await Notification.aggregate([
    { $match: { kind: { $in: rules.REMINDER_KINDS }, createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$kind',
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $ifNull: ['$readAt', false] }, 1, 0] } },
        emailSent: is('$channels.email.status', ['sent', 'queued']),
        emailFailed: is('$channels.email.status', ['failed']),
        pushSent: is('$channels.push.status', ['sent']),
        pushFailed: is('$channels.push.status', ['failed']),
      },
    },
  ]);
  const byKind = new Map(rows.map((r) => [r._id, r]));
  const zero = { total: 0, read: 0, emailSent: 0, emailFailed: 0, pushSent: 0, pushFailed: 0 };
  return {
    days,
    since,
    kinds: rules.REMINDER_KINDS.map((kind) => {
      const { _id, ...counts } = byKind.get(kind) || { ...zero };
      return { kind, ...zero, ...counts };
    }),
  };
}

/** Save reminder settings (field by field) and return them normalised. */
export async function updateReminderSettings(patch) {
  const set = {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) set[`reminders.${key}`] = value;
  const doc = await Settings.findOneAndUpdate({}, { $set: set }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  return rules.normalizeReminderSettings(doc.reminders);
}

/** Recent runs for the history panel. */
export async function listReminderRuns(limit = 10) {
  return ReminderRun.find({ trigger: { $ne: 'test' } }).sort({ startedAt: -1 }).limit(limit).populate('triggeredBy', 'name').lean();
}
