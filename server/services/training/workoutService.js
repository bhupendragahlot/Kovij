/**
 * Workout plans (templates), what each member is following (assignments), and the sessions
 * they log. Assignments are snapshots: editing a template never changes a member's plan.
 */
import WorkoutPlan from '../../models/WorkoutPlan.js';
import WorkoutAssignment from '../../models/WorkoutAssignment.js';
import WorkoutLog from '../../models/WorkoutLog.js';
import Member from '../../models/Member.js';
import Trainer from '../../models/Trainer.js';
import { getSettingsDoc } from '../../models/Settings.js';
import { notifyMember } from '../notify.js';
import { AppError } from '../../middleware/errorHandler.js';
import { withTransaction } from '../../utils/db.js';
import { escapeRegex } from '../../utils/strings.js';
import { gymDayKey, parseGymDay, startOfGymDay, toGymTime } from '../../utils/time.js';
import { logger } from '../../utils/logger.js';
import { LIMITS } from './constants.js';
import { exercisesById } from './exerciseService.js';
import { exerciseOverview, exerciseSeries, personalBest, suggestNextDay, summarizeEntries } from './math.js';
import { last30Start } from './trainerService.js';
import './emails.js';

const planNotFound = () => new AppError('Workout plan not found', 404, 'NOT_FOUND');
const memberNotFound = () => new AppError('Member not found', 404, 'NOT_FOUND');

// ── Templates ──────────────────────────────────────────────────────────────

/** Library entries for every exercise in `days`; 422 naming each one that no longer exists. */
async function resolveExercises(days, pathPrefix = 'days') {
  const lib = await exercisesById(days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
  const fields = {};
  days.forEach((d, i) =>
    d.exercises.forEach((e, j) => {
      if (!lib.has(String(e.exerciseId))) fields[`${pathPrefix}.${i}.exercises.${j}.exerciseId`] = 'This exercise is no longer in the library';
    })
  );
  if (Object.keys(fields).length) {
    throw new AppError('Some exercises are no longer in the library. Remove them and save again.', 422, 'VALIDATION_ERROR', { fields });
  }
  return lib;
}

const templateDays = (days) =>
  days.map((d) => ({
    name: d.name,
    exercises: d.exercises.map((e, order) => ({
      exerciseId: e.exerciseId,
      sets: e.sets,
      reps: e.reps,
      weightKg: e.weightKg ?? undefined,
      restSec: e.restSec ?? 60,
      notes: e.notes || '',
      order,
    })),
  }));

/** A member's own copy of the days: library details copied in so the plan reads on its own. */
const snapshotDays = (days, lib) =>
  days.map((d) => ({
    name: d.name,
    exercises: d.exercises.map((e, order) => {
      const x = lib.get(String(e.exerciseId));
      return {
        exerciseId: e.exerciseId,
        name: x.name,
        primaryMuscle: x.primaryMuscle,
        equipment: x.equipment,
        category: x.category,
        instructions: x.instructions || '',
        videoUrl: x.videoUrl || '',
        sets: e.sets,
        reps: e.reps,
        weightKg: e.weightKg ?? undefined,
        restSec: e.restSec ?? 60,
        notes: e.notes || '',
        order,
      };
    }),
  }));

const exerciseCount = (days = []) => days.reduce((n, d) => n + (d.exercises?.length || 0), 0);

async function activeCounts(planIds) {
  const rows = await WorkoutAssignment.aggregate([
    { $match: { planId: { $in: planIds }, status: 'active' } },
    { $group: { _id: '$planId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listPlans({ q, goal, level, status, page, limit }) {
  const filter = { archived: status === 'archived' };
  if (goal !== 'all') filter.goal = goal;
  if (level !== 'all') filter.level = level;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');
  const [plans, total, archivedCount] = await Promise.all([
    WorkoutPlan.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name goal level daysPerWeek days.name days.exercises.exerciseId notes archived updatedAt createdAt')
      .lean(),
    WorkoutPlan.countDocuments(filter),
    WorkoutPlan.countDocuments({ archived: true }),
  ]);
  const counts = await activeCounts(plans.map((p) => p._id));
  const items = plans.map(({ days, ...p }) => ({
    ...p,
    dayNames: days.map((d) => d.name),
    dayCount: days.length,
    exerciseCount: exerciseCount(days),
    activeMembers: counts.get(String(p._id)) || 0,
  }));
  return { items, total, page, limit, archivedCount };
}

/** A template with each exercise's library details attached for the builder. */
export async function getPlan(id) {
  const plan = await WorkoutPlan.findById(id).lean();
  if (!plan) throw planNotFound();
  const lib = await exercisesById(plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)));
  const counts = await activeCounts([plan._id]);
  return {
    ...plan,
    days: plan.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => {
        const x = lib.get(String(e.exerciseId));
        return {
          ...e,
          exercise: x
            ? { _id: x._id, name: x.name, primaryMuscle: x.primaryMuscle, equipment: x.equipment, category: x.category, archived: x.archived }
            : { _id: e.exerciseId, name: 'Removed exercise', archived: true },
        };
      }),
    })),
    activeMembers: counts.get(String(plan._id)) || 0,
  };
}

export async function createPlan(input, staff) {
  await resolveExercises(input.days);
  const plan = await WorkoutPlan.create({ ...input, notes: input.notes || '', days: templateDays(input.days), createdBy: staff.id, updatedBy: staff.id });
  return getPlan(plan._id);
}

export async function updatePlan(id, patch, staff) {
  const plan = await WorkoutPlan.findById(id);
  if (!plan) throw planNotFound();
  const { days, archived, ...fields } = patch;
  if (days) {
    await resolveExercises(days);
    plan.days = templateDays(days);
  }
  for (const [k, v] of Object.entries(fields)) plan[k] = v === undefined && k === 'notes' ? '' : v;
  if (archived !== undefined) {
    plan.archived = archived;
    plan.archivedAt = archived ? new Date() : undefined;
  }
  plan.updatedBy = staff.id;
  await plan.save();
  return getPlan(plan._id);
}

export async function duplicatePlan(id, staff) {
  const source = await WorkoutPlan.findById(id).lean();
  if (!source) throw planNotFound();
  const name = `${source.name} (copy)`.slice(0, 120);
  const copy = await WorkoutPlan.create({
    name,
    goal: source.goal,
    level: source.level,
    daysPerWeek: source.daysPerWeek,
    notes: source.notes,
    days: source.days.map((d) => ({ name: d.name, exercises: d.exercises.map(({ _id, ...e }) => e) })),
    createdBy: staff.id,
    updatedBy: staff.id,
  });
  return getPlan(copy._id);
}

/** Delete a template nobody was ever given; otherwise archive it so history keeps its source. */
export async function removePlan(id) {
  const plan = await WorkoutPlan.findById(id);
  if (!plan) throw planNotFound();
  const everAssigned = await WorkoutAssignment.exists({ planId: plan._id });
  if (everAssigned) {
    plan.archived = true;
    plan.archivedAt = new Date();
    await plan.save();
    return { archived: true, name: plan.name };
  }
  await plan.deleteOne();
  return { deleted: true, name: plan.name };
}

// ── Assignments ────────────────────────────────────────────────────────────

const formatDay = (dayKey) => parseGymDay(dayKey).format('ddd, D MMM');

async function sendAssignedNotices(created, { gymName, staff }) {
  const results = await Promise.allSettled(
    created.map(({ assignment, trainerName }) =>
      notifyMember({
        memberId: assignment.memberId,
        kind: 'workout',
        title: `Your workout plan: ${assignment.name}`,
        body: `Starts ${formatDay(assignment.startDay)}. ${assignment.days.length} ${assignment.days.length === 1 ? 'day' : 'days'} to rotate through, ${assignment.daysPerWeek} sessions a week.`,
        link: '/member/workouts',
        email: {
          templateKey: 'workoutAssigned',
          vars: {
            planName: assignment.name,
            startDay: assignment.startDay,
            daysPerWeek: assignment.daysPerWeek,
            days: assignment.days.map((d) => ({ name: d.name, exercises: d.exercises.map((e) => ({ name: e.name })) })),
            trainerName,
            gymName,
          },
        },
        preference: 'workoutUpdates',
        dedupeKey: `workout:${assignment._id}:assigned`,
        meta: { assignmentId: String(assignment._id), planId: assignment.planId ? String(assignment.planId) : undefined },
        createdBy: staff.id,
      })
    )
  );
  for (const r of results) if (r.status === 'rejected') logger.warn(`workout notice failed: ${r.reason?.message}`);
}

/**
 * Give a template to one or more members from `startDate` (default today). Each member's
 * current plan ends ("replaced") in the same transaction. Retrying with the same
 * Idempotency-Key returns the same assignments instead of creating new ones.
 */
export async function assignPlan(planId, { memberIds, startDate, notes, notify }, staff, idempotencyKey) {
  const plan = await WorkoutPlan.findById(planId).lean();
  if (!plan) throw planNotFound();
  if (plan.archived) throw new AppError('This plan is archived. Restore it before giving it to members.', 409, 'PLAN_ARCHIVED');
  if (!exerciseCount(plan.days)) {
    throw new AppError('Add at least one exercise to this plan before giving it to members', 422, 'PLAN_EMPTY');
  }

  const members = await Member.find({ _id: { $in: memberIds } }).select('name assignedTrainerId').lean();
  if (members.length !== memberIds.length) {
    const have = new Set(members.map((m) => String(m._id)));
    throw new AppError('Some members were not found. Refresh and try again.', 404, 'MEMBER_NOT_FOUND', {
      missing: memberIds.filter((id) => !have.has(String(id))),
    });
  }

  const lib = await resolveExercises(plan.days);
  const days = snapshotDays(plan.days, lib);
  const startDay = startDate || gymDayKey();
  const startsAt = parseGymDay(startDay).toDate();
  const now = new Date();
  const today = gymDayKey(now);

  const outcome = await withTransaction(async (session) => {
    const rows = [];
    for (const m of members) {
      const key = idempotencyKey ? `${idempotencyKey}:${m._id}` : undefined;
      if (key) {
        const existing = await WorkoutAssignment.findOne({ idempotencyKey: key }).session(session).lean();
        if (existing) {
          rows.push({ assignment: existing, member: m, replayed: true });
          continue;
        }
      }
      const previous = await WorkoutAssignment.findOneAndUpdate(
        { memberId: m._id, status: 'active' },
        { $set: { status: 'ended', endedAt: now, endDay: today, endReason: 'replaced' } },
        { session, new: true }
      ).lean();
      const [assignment] = await WorkoutAssignment.create(
        [
          {
            memberId: m._id,
            planId: plan._id,
            trainerId: m.assignedTrainerId,
            name: plan.name,
            goal: plan.goal,
            level: plan.level,
            daysPerWeek: plan.daysPerWeek,
            notes: notes ?? plan.notes ?? '',
            days,
            startDay,
            startsAt,
            assignedBy: staff.id,
            updatedBy: staff.id,
            idempotencyKey: key,
          },
        ],
        { session }
      );
      rows.push({ assignment: assignment.toObject(), member: m, previous });
    }
    return rows;
  });

  const created = outcome.filter((r) => !r.replayed);
  if (notify && created.length) {
    const trainerIds = created.map((r) => r.member.assignedTrainerId).filter(Boolean);
    const [settings, trainers] = await Promise.all([getSettingsDoc(), Trainer.find({ _id: { $in: trainerIds } }).select('name').lean()]);
    const trainerName = new Map(trainers.map((t) => [String(t._id), t.name]));
    await sendAssignedNotices(
      created.map((r) => ({ assignment: r.assignment, trainerName: r.member.assignedTrainerId && trainerName.get(String(r.member.assignedTrainerId)) })),
      { gymName: settings.gymName, staff }
    );
  }

  return {
    plan: { _id: plan._id, name: plan.name },
    startDay,
    assignments: outcome.map((r) => ({
      assignmentId: r.assignment._id,
      memberId: r.member._id,
      memberName: r.member.name,
      replaced: r.previous ? { assignmentId: r.previous._id, name: r.previous.name } : null,
      replayed: Boolean(r.replayed),
    })),
  };
}

async function activeAssignmentOrThrow(id) {
  const assignment = await WorkoutAssignment.findById(id);
  if (!assignment) throw new AppError('Workout plan not found for this member', 404, 'NOT_FOUND');
  if (assignment.status !== 'active') {
    throw new AppError('This plan has already ended. Give the member a new plan instead.', 409, 'ASSIGNMENT_ENDED');
  }
  return assignment;
}

/** Change one member's copy (sets, weights, exercises, days). The template is not touched. */
export async function updateAssignment(id, patch, staff) {
  const assignment = await activeAssignmentOrThrow(id);
  const { days, startDate, notify = true, ...fields } = patch;
  if (days) {
    const lib = await resolveExercises(days);
    assignment.days = snapshotDays(days, lib);
  }
  if (startDate) {
    assignment.startDay = startDate;
    assignment.startsAt = parseGymDay(startDate).toDate();
  }
  if ('name' in fields) assignment.name = fields.name;
  if ('notes' in fields) assignment.notes = fields.notes || '';
  if ('daysPerWeek' in fields) assignment.daysPerWeek = fields.daysPerWeek;
  assignment.version += 1;
  assignment.updatedBy = staff.id;
  await assignment.save();

  if (notify) {
    notifyMember({
      memberId: assignment.memberId,
      kind: 'workout',
      title: 'Your workout plan was updated',
      body: `${staff.name || 'Your trainer'} changed ${assignment.name}. Check today's exercises before you start.`,
      link: '/member/workouts',
      preference: 'workoutUpdates',
      dedupeKey: `workout:${assignment._id}:v${assignment.version}`,
      meta: { assignmentId: String(assignment._id) },
      createdBy: staff.id,
    }).catch((e) => logger.warn(`workout update notice failed: ${e.message}`));
  }
  return assignment.toObject();
}

export async function endAssignment(id, { note }, staff) {
  const assignment = await activeAssignmentOrThrow(id);
  assignment.status = 'ended';
  assignment.endedAt = new Date();
  assignment.endDay = gymDayKey();
  assignment.endReason = 'ended';
  assignment.endNote = note || '';
  assignment.updatedBy = staff.id;
  await assignment.save();
  return assignment.toObject();
}

// ── Member view (shared by staff and the member app) ──────────────────────

/** Today's suggested plan day, or when the plan starts. */
async function todayFor(assignment, now = new Date()) {
  if (!assignment) return null;
  const todayKey = gymDayKey(now);
  if (assignment.startsAt > startOfGymDay(now)) {
    return { dayKey: todayKey, startsOn: assignment.startDay, dayIndex: 0, doneToday: false, day: assignment.days[0] || null, log: null };
  }
  const logs = await WorkoutLog.find({ assignmentId: assignment._id })
    .sort({ performedAt: -1, createdAt: -1 })
    .limit(30)
    .select('dayKey dayIndex performedAt createdAt')
    .lean();
  const next = suggestNextDay({ dayCount: assignment.days.length, logs, todayKey });
  if (!next) return null;
  const log = next.doneToday
    ? await WorkoutLog.findOne({ memberId: assignment.memberId, dayKey: todayKey, dayIndex: next.dayIndex }).lean()
    : null;
  return { dayKey: todayKey, startsOn: null, dayIndex: next.dayIndex, doneToday: next.doneToday, lastSessionDay: next.lastDayKey, day: assignment.days[next.dayIndex], log };
}

const historyFields = 'name planId goal level daysPerWeek startDay startsAt status endDay endReason endNote createdAt days.name';

const historyRow = (a) => ({ ...a, dayCount: a.days?.length || 0, days: undefined });

/** Everything the member profile's Workouts tab shows. */
export async function memberOverview(memberId, now = new Date()) {
  const member = await Member.findById(memberId).select('name memberCode profilePhoto assignedTrainerId').lean();
  if (!member) throw memberNotFound();
  const since = last30Start(now);
  const [current, history, recent, sessions30, totalSessions, trainer] = await Promise.all([
    WorkoutAssignment.findOne({ memberId, status: 'active' }).lean(),
    WorkoutAssignment.find({ memberId, status: 'ended' }).sort({ startsAt: -1 }).limit(20).select(historyFields).lean(),
    WorkoutLog.find({ memberId }).sort({ performedAt: -1, createdAt: -1 }).limit(5).lean(),
    WorkoutLog.countDocuments({ memberId, performedAt: { $gte: since } }),
    WorkoutLog.countDocuments({ memberId }),
    member.assignedTrainerId ? Trainer.findById(member.assignedTrainerId).select('name image role phone isActive').lean() : null,
  ]);
  return {
    member: { _id: member._id, name: member.name, memberCode: member.memberCode, profilePhoto: member.profilePhoto },
    trainer,
    current,
    today: await todayFor(current, now),
    history: history.map(historyRow),
    recentLogs: recent,
    stats: { sessions30, totalSessions },
  };
}

/** Member app: the current plan with today's suggested day. */
export async function memberPlan(memberId, now = new Date()) {
  const exists = await Member.exists({ _id: memberId });
  if (!exists) throw memberNotFound();
  const current = await WorkoutAssignment.findOne({ memberId, status: 'active' })
    .select('-idempotencyKey -assignedBy -updatedBy -trainerId')
    .lean();
  return { plan: current, today: await todayFor(current, now) };
}

export async function assignmentHistory(memberId) {
  const items = await WorkoutAssignment.find({ memberId }).sort({ startsAt: -1, createdAt: -1 }).limit(50).select(historyFields).lean();
  return items.map(historyRow);
}

// ── Sessions ───────────────────────────────────────────────────────────────

/** The plan a member was following on a given gym day (latest start first). */
async function assignmentOnDay(memberId, dayStart) {
  const dayEnd = toGymTime(dayStart).endOf('day').toDate();
  return WorkoutAssignment.findOne({
    memberId,
    startsAt: { $lte: dayEnd },
    $or: [{ status: 'active' }, { endedAt: { $gte: dayStart } }],
  })
    .sort({ status: 1, startsAt: -1 })
    .lean();
}

/**
 * Save one session: created the first time, updated in place when the same member, day and
 * plan day are saved again (so retries and corrections never duplicate it).
 * @param {{ kind: 'member'|'staff', userId?: string }} actor
 * @returns {{ log, created: boolean }}
 */
export async function saveLog(memberId, input, actor, now = new Date()) {
  const exists = await Member.exists({ _id: memberId });
  if (!exists) throw memberNotFound();

  const dayKey = input.date || gymDayKey(now);
  const dayStart = parseGymDay(dayKey).toDate();
  if (dayStart > startOfGymDay(now)) {
    throw new AppError("A session can't be logged for a future date", 422, 'VALIDATION_ERROR', { fields: { date: 'Choose today or an earlier day' } });
  }
  const maxBack = actor.kind === 'member' ? LIMITS.memberLogDaysBack : LIMITS.staffLogDaysBack;
  if (dayStart < startOfGymDay(toGymTime(now).subtract(maxBack, 'day'))) {
    throw new AppError(`Sessions can be logged up to ${maxBack} days back`, 422, 'VALIDATION_ERROR', {
      fields: { date: `Choose a day in the last ${maxBack} days` },
    });
  }

  const assignment = await assignmentOnDay(memberId, dayStart);
  let dayName = 'Workout';
  if (assignment) {
    const day = assignment.days[input.dayIndex];
    if (!day) {
      throw new AppError(`This plan has ${assignment.days.length} ${assignment.days.length === 1 ? 'day' : 'days'}`, 422, 'VALIDATION_ERROR', {
        fields: { dayIndex: 'Choose a day from the plan' },
      });
    }
    dayName = day.name;
  } else if (input.dayIndex !== 0) {
    throw new AppError('There was no workout plan on that day', 422, 'VALIDATION_ERROR', { fields: { dayIndex: 'Log it as a single workout' } });
  }

  // Names: the member's plan first (what they were told to do), then the library.
  const planNames = new Map((assignment?.days || []).flatMap((d) => d.exercises.map((e) => [String(e.exerciseId), e.name])));
  const missing = input.entries.map((e) => String(e.exerciseId)).filter((id) => !planNames.has(id));
  const lib = missing.length ? await exercisesById(missing) : new Map();
  const fields = {};
  const entries = input.entries.map((e, i) => {
    const id = String(e.exerciseId);
    const name = planNames.get(id) || lib.get(id)?.name;
    if (!name) fields[`entries.${i}.exerciseId`] = 'This exercise is no longer in the library';
    return {
      exerciseId: e.exerciseId,
      name,
      sets: e.sets.map((s) => ({ reps: s.reps, weightKg: Math.round(Number(s.weightKg || 0) * 100) / 100, done: s.done !== false })),
    };
  });
  if (Object.keys(fields).length) throw new AppError('Some exercises are no longer in the library', 422, 'VALIDATION_ERROR', { fields });

  const totals = summarizeEntries(entries);
  const filter = { memberId, dayKey, dayIndex: input.dayIndex };
  const update = {
    $set: {
      assignmentId: assignment?._id,
      performedAt: dayStart,
      dayName,
      entries,
      notes: input.notes || '',
      volumeKg: totals.volumeKg,
      setsDone: totals.setsDone,
      loggedBy: actor.kind,
    },
  };
  if (!assignment) {
    delete update.$set.assignmentId;
    update.$unset = { assignmentId: 1 };
  }
  if (actor.userId) update.$set.loggedByUserId = actor.userId;
  else update.$unset = { ...update.$unset, loggedByUserId: 1 };

  const upsert = () =>
    WorkoutLog.findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true, includeResultMetadata: true });
  let result;
  try {
    result = await upsert();
  } catch (e) {
    // Two saves of the same session raced to insert; the second becomes an update.
    if (e?.code !== 11000) throw e;
    result = await upsert();
  }
  return { log: result.value.toObject(), created: !result.lastErrorObject?.updatedExisting };
}

export async function listLogs(memberId, { page, limit }) {
  const [items, total] = await Promise.all([
    WorkoutLog.find({ memberId })
      .sort({ performedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('loggedByUserId', 'name username')
      .lean(),
    WorkoutLog.countDocuments({ memberId }),
  ]);
  return {
    items: items.map(({ loggedByUserId, ...l }) => ({
      ...l,
      loggedByName: loggedByUserId ? loggedByUserId.name || loggedByUserId.username : null,
    })),
    total,
    page,
    limit,
  };
}

export async function getMemberLog(memberId, logId) {
  const log = await WorkoutLog.findOne({ _id: logId, memberId }).lean();
  if (!log) throw new AppError('Session not found', 404, 'NOT_FOUND');
  return log;
}

export async function deleteLog(logId) {
  const log = await WorkoutLog.findByIdAndDelete(logId).lean();
  if (!log) throw new AppError('Session not found', 404, 'NOT_FOUND');
  return log;
}

// ── Progress ───────────────────────────────────────────────────────────────

const PROGRESS_LOGS = 300;

/** Every exercise the member has logged, with last and best sets. */
export async function progressOverview(memberId) {
  const exists = await Member.exists({ _id: memberId });
  if (!exists) throw memberNotFound();
  const logs = await WorkoutLog.find({ memberId })
    .sort({ performedAt: -1 })
    .limit(PROGRESS_LOGS)
    .select('dayKey performedAt createdAt entries volumeKg')
    .lean();
  const sessions = [...logs]
    .reverse()
    .slice(-30)
    .map((l) => ({ logId: l._id, dayKey: l.dayKey, volumeKg: l.volumeKg || 0 }));
  return { exercises: exerciseOverview(logs), sessions };
}

/** One exercise over time: best set, estimated 1RM and volume per session. */
export async function exerciseProgress(memberId, exerciseId) {
  const exists = await Member.exists({ _id: memberId });
  if (!exists) throw memberNotFound();
  const logs = await WorkoutLog.find({ memberId, 'entries.exerciseId': exerciseId })
    .sort({ performedAt: -1 })
    .limit(100)
    .select('dayKey performedAt createdAt entries')
    .lean();
  const lib = await exercisesById([exerciseId]);
  const x = lib.get(String(exerciseId));
  const name = x?.name || logs[0]?.entries.find((e) => String(e.exerciseId) === String(exerciseId))?.name;
  if (!name) throw new AppError('Exercise not found', 404, 'NOT_FOUND');
  const points = exerciseSeries(logs, exerciseId);
  const best = personalBest(points);
  return {
    exercise: { _id: exerciseId, name, primaryMuscle: x?.primaryMuscle, equipment: x?.equipment, category: x?.category },
    points,
    best: best ? { ...best.bestSet, e1rm: best.e1rm, dayKey: best.dayKey } : null,
  };
}
