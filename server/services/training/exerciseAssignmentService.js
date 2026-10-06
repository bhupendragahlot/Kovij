/**
 * ExerciseDB exercises scheduled for members on specific days: trainers assign them, members
 * tick them off, and owners see how it's going.
 *
 * Who may change what
 *   admin, manager  any member
 *   trainer         their own members (Member.assignedTrainerId); everyone else is read-only
 *   member          marks their own exercises done (up to LIMITS.memberLogDaysBack days late)
 *
 * The schedule uses the gym's calendar (Asia/Kolkata) and a Monday–Sunday week.
 */
import mongoose from 'mongoose';
import ExerciseAssignment from '../../models/ExerciseAssignment.js';
import Member from '../../models/Member.js';
import Trainer from '../../models/Trainer.js';
import { notifyMember } from '../notify.js';
import { AppError } from '../../middleware/errorHandler.js';
import { gymDayKey, parseGymDay, startOfGymDay, toGymTime } from '../../utils/time.js';
import { logger } from '../../utils/logger.js';
import { LIMITS } from './constants.js';
import { getExerciseDbExercises } from './exerciseDb.js';
import { trainerForUser } from './trainerService.js';

const toId = (id) => new mongoose.Types.ObjectId(String(id));
const shiftDay = (dayKey, days) => parseGymDay(dayKey).add(days, 'day').format('YYYY-MM-DD');
const formatDay = (dayKey) => parseGymDay(dayKey).format('ddd, D MMM');

/** The gym days the member views are built from. */
export function scheduleWindows(now = new Date()) {
  const today = toGymTime(now).startOf('day');
  const todayKey = today.format('YYYY-MM-DD');
  const sinceMonday = (today.day() + 6) % 7;
  return {
    todayKey,
    weekStartKey: shiftDay(todayKey, -sinceMonday),
    weekEndKey: shiftDay(todayKey, 6 - sinceMonday),
    overdueFromKey: shiftDay(todayKey, -LIMITS.memberLogDaysBack),
  };
}

/** done / missed / today / upcoming / cancelled, as of `todayKey`. */
export function assignmentState(a, todayKey) {
  if (a.status === 'completed') return 'done';
  if (a.status === 'cancelled') return 'cancelled';
  if (a.dayKey < todayKey) return 'missed';
  return a.dayKey === todayKey ? 'today' : 'upcoming';
}

/** What a client sees. Staff-only fields stay out of the member's copy. */
export function presentAssignment(a, { todayKey = gymDayKey(), staff = false } = {}) {
  const out = {
    _id: a._id,
    memberId: a.memberId,
    exercise: a.exercise,
    dayKey: a.dayKey,
    order: a.order,
    sets: a.sets ?? null,
    reps: a.reps || '',
    durationSec: a.durationSec ?? null,
    restSec: a.restSec ?? null,
    weightKg: a.weightKg ?? null,
    notes: a.notes || '',
    status: a.status,
    state: assignmentState(a, todayKey),
    completedAt: a.completedAt || null,
    completedBy: a.completedBy || null,
    memberNote: a.memberNote || '',
    createdAt: a.createdAt,
  };
  if (staff) {
    out.trainerId = a.trainerId || null;
    out.cancelledAt = a.cancelledAt || null;
  }
  return out;
}

// ── Who may manage whom ────────────────────────────────────────────────────

/** Trainers work with their own members; admins and managers with everyone. */
async function staffScope(actor) {
  if (actor.role !== 'trainer') return { all: true };
  const own = await trainerForUser(actor.id);
  return { all: false, trainerId: own ? String(own._id) : null };
}

function canManage(member, scope) {
  return scope.all || (Boolean(scope.trainerId) && String(member.assignedTrainerId || '') === scope.trainerId);
}

async function assertCanManage(member, actor) {
  const scope = await staffScope(actor);
  if (canManage(member, scope)) return scope;
  if (!scope.trainerId) {
    throw new AppError('Your login is not linked to a trainer profile yet. Ask the owner to link it under Trainers.', 403, 'TRAINER_NOT_LINKED');
  }
  throw new AppError(`${member.name} is not one of your members. Ask a manager to assign them to you first.`, 403, 'NOT_YOUR_MEMBER');
}

async function memberOr404(memberId) {
  const member = await Member.findById(memberId).select('name memberCode profilePhoto assignedTrainerId').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  return member;
}

// ── Assigning ──────────────────────────────────────────────────────────────

const snapshot = (e) => ({
  exerciseDbId: e.id,
  name: e.name.slice(0, 160),
  bodyParts: e.bodyParts,
  targetMuscles: e.targetMuscles,
  equipments: e.equipments,
  primaryMuscle: e.primaryMuscle,
  equipment: e.equipment,
  category: e.category,
});

async function nextOrders(memberId, dayKeys) {
  const rows = await ExerciseAssignment.aggregate([
    { $match: { memberId: toId(memberId), dayKey: { $in: dayKeys } } },
    { $group: { _id: '$dayKey', max: { $max: '$order' } } },
  ]);
  return new Map(rows.map((r) => [r._id, (r.max ?? -1) + 1]));
}

async function sendAssignedNotice({ member, rows, dayKeys, trainerName, actor, idempotencyKey }) {
  const exerciseNames = [...new Set(rows.map((r) => r.exercise.name))];
  const count = exerciseNames.length;
  const when = dayKeys.length > 1 ? `${formatDay(dayKeys[0])}, then every week for ${dayKeys.length} weeks` : formatDay(dayKeys[0]);
  const listed = exerciseNames.slice(0, 4).join(', ') + (count > 4 ? ` and ${count - 4} more` : '');
  try {
    await notifyMember({
      memberId: member._id,
      kind: 'workout',
      title: `${count} ${count === 1 ? 'exercise' : 'exercises'} from ${trainerName || 'your trainer'}`,
      body: `For ${when}: ${listed}.`,
      link: '/member/workouts?tab=schedule',
      preference: 'workoutUpdates',
      dedupeKey: idempotencyKey ? `exercises:${member._id}:${idempotencyKey}` : undefined,
      meta: { dayKey: dayKeys[0] },
      createdBy: actor.id,
    });
  } catch (e) {
    // The exercises are saved; a failed notice must not turn that into an error.
    logger.warn(`Exercise assignment notice failed: ${e.message}`, { memberId: String(member._id) });
  }
}

/**
 * Schedules ExerciseDB exercises for one member on `date`, repeated weekly `repeatWeeks` times.
 * Each exercise is looked up in ExerciseDB first, so only real exercises are saved and their
 * names come from ExerciseDB, not the browser.
 * @param {{ date: string, repeatWeeks: number, items: object[], notify: boolean }} input
 */
export async function assignExercises(memberId, input, actor, idempotencyKey, now = new Date()) {
  const member = await memberOr404(memberId);
  await assertCanManage(member, actor);

  const todayKey = gymDayKey(now);
  if (input.date < todayKey) {
    throw new AppError('Choose today or a later day', 422, 'VALIDATION_ERROR', { fields: { date: 'Choose today or a later day' } });
  }
  if (input.date > shiftDay(todayKey, LIMITS.assignDaysAhead)) {
    throw new AppError('Choose a day within the next year', 422, 'VALIDATION_ERROR', { fields: { date: 'Choose a day within the next year' } });
  }
  const dayKeys = Array.from({ length: input.repeatWeeks }, (_, i) => shiftDay(input.date, i * 7));
  if (dayKeys.length * input.items.length > LIMITS.assignRowsMax) {
    throw new AppError(`That is more than ${LIMITS.assignRowsMax} exercises in one go. Repeat for fewer weeks.`, 422, 'TOO_MANY_EXERCISES');
  }

  // A retry after a crash between saving and replying finds the first attempt's rows.
  if (idempotencyKey) {
    const earlier = await ExerciseAssignment.find({ idempotencyKey: { $regex: `^${idempotencyKey}:` } })
      .sort({ dayKey: 1, order: 1 })
      .lean();
    if (earlier.length) return { member: { _id: member._id, name: member.name }, assignments: earlier.map((a) => presentAssignment(a, { todayKey, staff: true })), replayed: true };
  }

  let exercises;
  try {
    exercises = await getExerciseDbExercises(input.items.map((i) => i.exerciseDbId));
  } catch (e) {
    if (e.code === 'EXERCISE_NOT_FOUND') {
      throw new AppError('One of these exercises is no longer in ExerciseDB. Remove it and try again.', 422, 'EXERCISE_NOT_FOUND');
    }
    throw e;
  }

  const firstOrder = await nextOrders(memberId, dayKeys);
  let n = 0;
  const docs = dayKeys.flatMap((dayKey) =>
    input.items.map((item, i) => ({
      memberId: member._id,
      trainerId: member.assignedTrainerId,
      exercise: snapshot(exercises.get(String(item.exerciseDbId))),
      dayKey,
      scheduledAt: startOfGymDay(parseGymDay(dayKey)),
      order: (firstOrder.get(dayKey) || 0) + i,
      sets: item.sets,
      reps: item.reps || '',
      durationSec: item.durationSec,
      restSec: item.restSec,
      weightKg: item.weightKg,
      notes: item.notes || '',
      assignedBy: actor.id,
      ...(idempotencyKey && { idempotencyKey: `${idempotencyKey}:${n++}` }),
    }))
  );

  let saved;
  try {
    saved = await ExerciseAssignment.insertMany(docs, { ordered: true });
  } catch (e) {
    if (e?.code !== 11000 || !idempotencyKey) throw e;
    // Two copies of the same request raced; the other one saved them.
    saved = await ExerciseAssignment.find({ idempotencyKey: { $regex: `^${idempotencyKey}:` } }).sort({ dayKey: 1, order: 1 });
  }
  const rows = saved.map((d) => (d.toObject ? d.toObject() : d));

  if (input.notify) {
    const trainer = member.assignedTrainerId ? await Trainer.findById(member.assignedTrainerId).select('name').lean() : null;
    await sendAssignedNotice({ member, rows, dayKeys, trainerName: trainer?.name, actor, idempotencyKey });
  }
  return { member: { _id: member._id, name: member.name }, assignments: rows.map((a) => presentAssignment(a, { todayKey, staff: true })) };
}

// ── Reading a member's schedule ────────────────────────────────────────────

/**
 * Today (with anything still undone from the last week), the rest of this week, later weeks,
 * and this week's tally. Completed history is paged separately (memberExerciseHistory).
 */
export async function memberExerciseSchedule(memberId, { staff = false, now = new Date() } = {}) {
  const w = scheduleWindows(now);
  const id = toId(memberId);
  const [rows, upcomingTotal, completedTotal] = await Promise.all([
    // overdueFromKey (a week back) always reaches this Monday too.
    ExerciseAssignment.find({ memberId: id, status: { $ne: 'cancelled' }, dayKey: { $gte: w.overdueFromKey, $lte: w.weekEndKey } })
      .sort({ dayKey: 1, order: 1, _id: 1 })
      .limit(500)
      .lean(),
    ExerciseAssignment.countDocuments({ memberId: id, status: 'assigned', dayKey: { $gt: w.weekEndKey } }),
    ExerciseAssignment.countDocuments({ memberId: id, status: 'completed' }),
  ]);
  const upcoming = await ExerciseAssignment.find({ memberId: id, status: 'assigned', dayKey: { $gt: w.weekEndKey } })
    .sort({ dayKey: 1, order: 1, _id: 1 })
    .limit(60)
    .lean();
  const show = (a) => presentAssignment(a, { todayKey: w.todayKey, staff });
  const week = rows.filter((a) => a.dayKey >= w.weekStartKey);
  return {
    ...w,
    today: rows.filter((a) => a.dayKey === w.todayKey).map(show),
    overdue: rows.filter((a) => a.dayKey < w.todayKey && a.dayKey >= w.overdueFromKey && a.status === 'assigned').map(show),
    thisWeek: rows.filter((a) => a.dayKey > w.todayKey).map(show),
    upcoming: upcoming.map(show),
    counts: {
      upcoming: upcomingTotal,
      completed: completedTotal,
      week: week.length,
      weekDone: week.filter((a) => a.status === 'completed').length,
    },
  };
}

/**
 * Past exercises, newest first. `done` = completed; `missed` = past days never ticked off;
 * `past` = both.
 */
export async function memberExerciseHistory(memberId, { status = 'done', page = 1, limit = 20 } = {}, { staff = false, now = new Date() } = {}) {
  const todayKey = gymDayKey(now);
  const id = toId(memberId);
  const done = { memberId: id, status: 'completed' };
  const missed = { memberId: id, status: 'assigned', dayKey: { $lt: todayKey } };
  const filter = status === 'done' ? done : status === 'missed' ? missed : { $or: [done, missed] };
  const [items, total] = await Promise.all([
    ExerciseAssignment.find(filter)
      .sort(status === 'done' ? { completedAt: -1, _id: -1 } : { dayKey: -1, order: 1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ExerciseAssignment.countDocuments(filter),
  ]);
  return { items: items.map((a) => presentAssignment(a, { todayKey, staff })), total, page, limit };
}

/** A member's schedule as staff see it, with whether this login may change it. */
export async function staffMemberSchedule(memberId, actor, now = new Date()) {
  const member = await memberOr404(memberId);
  const scope = await staffScope(actor);
  const schedule = await memberExerciseSchedule(memberId, { staff: true, now });
  return { member: { _id: member._id, name: member.name, assignedTrainerId: member.assignedTrainerId || null }, canManage: canManage(member, scope), ...schedule };
}

// ── Changing one assignment ────────────────────────────────────────────────

/** `who`: { kind: 'member', memberId } or { kind: 'staff', actor }. Returns the assignment document. */
async function loadFor(id, who) {
  const a = await ExerciseAssignment.findById(id);
  // A member asking about someone else's exercise gets the same answer as a missing one.
  if (!a || (who.kind === 'member' && String(a.memberId) !== String(who.memberId))) {
    throw new AppError('Exercise not found', 404, 'NOT_FOUND');
  }
  if (who.kind === 'staff') await assertCanManage(await memberOr404(a.memberId), who.actor);
  return a;
}

function assertTickable(a, who, now) {
  const todayKey = gymDayKey(now);
  if (a.status === 'cancelled') throw new AppError('Your trainer removed this exercise', 409, 'EXERCISE_CANCELLED');
  if (a.dayKey > todayKey) throw new AppError(`This is for ${formatDay(a.dayKey)}. Tick it off on the day.`, 409, 'NOT_DUE_YET');
  const back = who.kind === 'member' ? LIMITS.memberLogDaysBack : LIMITS.staffLogDaysBack;
  if (a.dayKey < shiftDay(todayKey, -back)) {
    throw new AppError(`This was more than ${back} days ago, so it can't be changed any more.`, 409, 'TOO_OLD');
  }
  return todayKey;
}

/** Marks an exercise done. Doing it twice is harmless (the second call returns the first result). */
export async function completeExerciseAssignment(id, { memberNote } = {}, who, now = new Date()) {
  const a = await loadFor(id, who);
  const todayKey = assertTickable(a, who, now);
  if (a.status !== 'completed') {
    a.status = 'completed';
    a.completedAt = now;
    a.completedBy = who.kind;
    a.completedByUserId = who.kind === 'staff' ? who.actor.id : undefined;
  }
  if (memberNote !== undefined) a.memberNote = memberNote || '';
  await a.save();
  return presentAssignment(a.toObject(), { todayKey, staff: who.kind === 'staff' });
}

/** Undoes "done" (a mistaken tap). Same time window as ticking it off. */
export async function reopenExerciseAssignment(id, who, now = new Date()) {
  const a = await loadFor(id, who);
  const todayKey = assertTickable(a, who, now);
  if (a.status === 'completed') {
    a.status = 'assigned';
    a.completedAt = undefined;
    a.completedBy = undefined;
    a.completedByUserId = undefined;
    await a.save();
  }
  return presentAssignment(a.toObject(), { todayKey, staff: who.kind === 'staff' });
}

/** Staff change the day or what to do. Done and removed exercises stay as they were. */
export async function updateExerciseAssignment(id, patch, actor, now = new Date()) {
  const a = await loadFor(id, { kind: 'staff', actor });
  if (a.status !== 'assigned') {
    throw new AppError(a.status === 'completed' ? 'This exercise is already done, so it stays as it is in the history.' : 'This exercise was removed.', 409, 'NOT_EDITABLE');
  }
  const todayKey = gymDayKey(now);
  if (patch.date && patch.date !== a.dayKey) {
    if (patch.date < todayKey) throw new AppError('Choose today or a later day', 422, 'VALIDATION_ERROR', { fields: { date: 'Choose today or a later day' } });
    a.dayKey = patch.date;
    a.scheduledAt = startOfGymDay(parseGymDay(patch.date));
    a.order = (await nextOrders(a.memberId, [patch.date])).get(patch.date) || 0;
  }
  for (const field of ['sets', 'reps', 'durationSec', 'restSec', 'weightKg', 'notes']) {
    if (patch[field] === undefined) continue;
    a[field] = patch[field] === null ? undefined : patch[field];
  }
  if (!a.sets && !a.durationSec) throw new AppError('Add sets and reps, or a time', 422, 'VALIDATION_ERROR', { fields: { sets: 'Add sets and reps, or a time' } });
  a.updatedBy = actor.id;
  await a.save();
  return presentAssignment(a.toObject(), { todayKey, staff: true });
}

/** Takes an exercise off the member's list. The record stays (as "cancelled") for the history. */
export async function cancelExerciseAssignment(id, actor, now = new Date()) {
  const a = await loadFor(id, { kind: 'staff', actor });
  if (a.status === 'completed') throw new AppError('This exercise is already done, so it stays in the history.', 409, 'NOT_EDITABLE');
  if (a.status !== 'cancelled') {
    a.status = 'cancelled';
    a.cancelledAt = now;
    a.cancelledByUserId = actor.id;
    a.updatedBy = actor.id;
    await a.save();
  }
  return presentAssignment(a.toObject(), { todayKey: gymDayKey(now), staff: true });
}

// ── Monitoring across members ──────────────────────────────────────────────

/** Mongo filter for the status chips, as of today. */
function stateFilter(state, todayKey) {
  if (state === 'done') return { status: 'completed' };
  if (state === 'missed') return { status: 'assigned', dayKey: { $lt: todayKey } };
  if (state === 'todo') return { status: 'assigned', dayKey: { $gte: todayKey } };
  if (state === 'cancelled') return { status: 'cancelled' };
  return { status: { $ne: 'cancelled' } };
}

/**
 * Every member's scheduled exercises between `from` and `to` (default: this week), with totals
 * and a per-trainer breakdown. Trainers only ever see their own members.
 */
export async function exerciseAssignmentOverview(query, actor, now = new Date()) {
  const w = scheduleWindows(now);
  const from = query.from || w.weekStartKey;
  const to = query.to || w.weekEndKey;
  if (from > to) throw new AppError('The start date is after the end date', 422, 'VALIDATION_ERROR', { fields: { from: 'Start before the end date' } });

  const scope = await staffScope(actor);
  const scoped = { dayKey: { $gte: from, $lte: to } };
  if (!scope.all) {
    if (!scope.trainerId) return { linked: false, from, to, todayKey: w.todayKey, items: [], total: 0, page: query.page, limit: query.limit, summary: emptySummary(), byTrainer: [] };
    const mine = await Member.find({ assignedTrainerId: toId(scope.trainerId) }).select('_id').lean();
    scoped.$or = [{ trainerId: toId(scope.trainerId) }, { memberId: { $in: mine.map((m) => m._id) } }];
  } else if (query.trainerId === 'none') {
    scoped.trainerId = { $exists: false };
  } else if (query.trainerId) {
    scoped.trainerId = toId(query.trainerId);
  }
  if (query.memberId) scoped.memberId = toId(query.memberId);

  const listFilter = { ...scoped, ...stateFilter(query.status, w.todayKey) };
  const [items, total, grouped] = await Promise.all([
    ExerciseAssignment.find(listFilter)
      .sort({ dayKey: query.status === 'todo' ? 1 : -1, memberId: 1, order: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    ExerciseAssignment.countDocuments(listFilter),
    ExerciseAssignment.aggregate([
      { $match: { ...scoped, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$trainerId',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          missed: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'assigned'] }, { $lt: ['$dayKey', w.todayKey] }] }, 1, 0] } },
          members: { $addToSet: '$memberId' },
        },
      },
    ]),
  ]);

  const memberIds = [...new Set(items.map((a) => String(a.memberId)))];
  const trainerIds = [...new Set([...items.map((a) => a.trainerId), ...grouped.map((g) => g._id)].filter(Boolean).map(String))];
  const [members, trainers] = await Promise.all([
    Member.find({ _id: { $in: memberIds } }).select('name memberCode profilePhoto').lean(),
    Trainer.find({ _id: { $in: trainerIds } }).select('name image').lean(),
  ]);
  const memberBy = new Map(members.map((m) => [String(m._id), m]));
  const trainerBy = new Map(trainers.map((t) => [String(t._id), t]));

  const allMembers = new Set(grouped.flatMap((g) => g.members.map(String)));
  const summary = summarize(grouped, allMembers.size);
  return {
    linked: true,
    from,
    to,
    todayKey: w.todayKey,
    items: items.map((a) => {
      const m = memberBy.get(String(a.memberId));
      const t = a.trainerId && trainerBy.get(String(a.trainerId));
      return {
        ...presentAssignment(a, { todayKey: w.todayKey, staff: true }),
        member: m ? { _id: m._id, name: m.name, memberCode: m.memberCode, profilePhoto: m.profilePhoto } : null,
        trainer: t ? { _id: t._id, name: t.name } : null,
      };
    }),
    total,
    page: query.page,
    limit: query.limit,
    summary,
    byTrainer: scope.all
      ? grouped
          .map((g) => ({
            trainer: g._id ? { _id: g._id, name: trainerBy.get(String(g._id))?.name || 'Former trainer' } : null,
            ...summarize([g], g.members.length),
          }))
          .sort((a, b) => b.total - a.total)
      : [],
  };
}

function emptySummary() {
  return { total: 0, done: 0, missed: 0, todo: 0, members: 0, completionRate: null };
}

/** Completion rate counts only exercises already due (done or missed), not future ones. */
export function summarize(groups, members) {
  const total = groups.reduce((s, g) => s + g.total, 0);
  const done = groups.reduce((s, g) => s + g.done, 0);
  const missed = groups.reduce((s, g) => s + g.missed, 0);
  const due = done + missed;
  return { total, done, missed, todo: total - done - missed, members, completionRate: due ? Math.round((done / due) * 100) : null };
}
