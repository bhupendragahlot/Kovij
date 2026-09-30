/**
 * Exercise library: built-in exercises (seeded once, idempotently) plus the gym's own.
 * Exercises that are built in, or used anywhere, are archived instead of deleted.
 */
import Exercise from '../../models/Exercise.js';
import WorkoutPlan from '../../models/WorkoutPlan.js';
import WorkoutAssignment from '../../models/WorkoutAssignment.js';
import WorkoutLog from '../../models/WorkoutLog.js';
import { AppError } from '../../middleware/errorHandler.js';
import { escapeRegex } from '../../utils/strings.js';
import { logger } from '../../utils/logger.js';
import { EXERCISE_SEED } from './exerciseSeed.js';
import { exerciseNameKey } from './math.js';

let seeding = null;

/**
 * Add the built-in exercises that are missing. Safe to run any number of times, from any
 * number of processes: each seed is an upsert on its `seedKey` that only writes on insert,
 * so a gym's edits (and archived built-ins) are never overwritten or brought back.
 */
export async function seedExerciseLibrary() {
  const ops = EXERCISE_SEED.map((e) => ({
    updateOne: {
      filter: { seedKey: e.seedKey },
      update: { $setOnInsert: { ...e, nameKey: exerciseNameKey(e.name), archived: false, videoUrl: '' } },
      upsert: true,
    },
  }));
  try {
    const res = await Exercise.bulkWrite(ops, { ordered: false });
    return { inserted: res.upsertedCount };
  } catch (e) {
    // A gym exercise with the same name as a built-in one wins; a parallel seed may also race us.
    const writeErrors = e?.writeErrors || e?.result?.getWriteErrors?.() || [];
    if (writeErrors.length && writeErrors.every((w) => (w.code ?? w.err?.code) === 11000)) {
      return { inserted: e?.result?.upsertedCount ?? 0 };
    }
    throw e;
  }
}

/** Seed once per process, on the first read of the library. */
export function ensureExerciseLibrary() {
  if (!seeding) {
    seeding = seedExerciseLibrary().catch((e) => {
      seeding = null;
      logger.error(`Exercise library seeding failed: ${e.message}`);
      throw e;
    });
  }
  return seeding;
}

export async function listExercises({ q, muscle, equipment, category, status, page, limit }) {
  await ensureExerciseLibrary();
  const base = { archived: status === 'archived' };
  if (equipment !== 'all') base.equipment = equipment;
  if (category !== 'all') base.category = category;
  if (q) base.name = new RegExp(escapeRegex(q), 'i');
  // By main muscle, so the per-muscle counts on the filter chips add up to the list.
  const filter = muscle === 'all' ? base : { ...base, primaryMuscle: muscle };

  const [items, total, counts] = await Promise.all([
    Exercise.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Exercise.countDocuments(filter),
    Exercise.aggregate([{ $match: base }, { $group: { _id: '$primaryMuscle', n: { $sum: 1 } } }]),
  ]);
  const byMuscle = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  byMuscle.all = counts.reduce((sum, c) => sum + c.n, 0);
  return { items: items.map(withBuiltIn), total, page, limit, counts: byMuscle };
}

const withBuiltIn = (e) => ({ ...e, builtIn: Boolean(e.seedKey) });

async function assertNameFree(name, exceptId) {
  const existing = await Exercise.findOne({ nameKey: exerciseNameKey(name), ...(exceptId && { _id: { $ne: exceptId } }) })
    .select('name archived')
    .lean();
  if (existing) {
    throw new AppError(
      existing.archived
        ? `"${existing.name}" is already in the library but archived. Restore it instead.`
        : `"${existing.name}" is already in the library`,
      409,
      'EXERCISE_EXISTS',
      { exerciseId: String(existing._id), archived: existing.archived, fields: { name: 'An exercise with this name already exists' } }
    );
  }
}

export async function createExercise(input, staff) {
  await ensureExerciseLibrary();
  await assertNameFree(input.name);
  try {
    const exercise = await Exercise.create({ ...input, nameKey: exerciseNameKey(input.name), createdBy: staff.id });
    return withBuiltIn(exercise.toObject());
  } catch (e) {
    if (e?.code === 11000) await assertNameFree(input.name);
    throw e;
  }
}

export async function updateExercise(id, patch) {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw new AppError('Exercise not found', 404, 'NOT_FOUND');
  if (patch.name !== undefined) {
    await assertNameFree(patch.name, id);
    exercise.nameKey = exerciseNameKey(patch.name);
  }
  const { archived, ...fields } = patch;
  Object.assign(exercise, fields);
  if (archived !== undefined) {
    exercise.archived = archived;
    exercise.archivedAt = archived ? new Date() : undefined;
  }
  await exercise.save();
  return withBuiltIn(exercise.toObject());
}

/** Where an exercise is used, so the UI can explain why it is archived instead of deleted. */
export async function exerciseUsage(id) {
  const [plans, activeAssignments, logs] = await Promise.all([
    WorkoutPlan.countDocuments({ 'days.exercises.exerciseId': id }),
    WorkoutAssignment.countDocuments({ 'days.exercises.exerciseId': id, status: 'active' }),
    WorkoutLog.exists({ 'entries.exerciseId': id }),
  ]);
  return { plans, activeAssignments, logged: Boolean(logs) };
}

/**
 * Delete a gym-made exercise nobody has used; otherwise archive it (hidden from pickers,
 * kept for history). Built-in exercises are always archived so seeding never re-adds them.
 */
export async function removeExercise(id) {
  const exercise = await Exercise.findById(id);
  if (!exercise) throw new AppError('Exercise not found', 404, 'NOT_FOUND');
  const usage = await exerciseUsage(exercise._id);
  const used = usage.plans > 0 || usage.activeAssignments > 0 || usage.logged;
  if (exercise.seedKey || used) {
    exercise.archived = true;
    exercise.archivedAt = new Date();
    await exercise.save();
    return { archived: true, usage, exercise: withBuiltIn(exercise.toObject()) };
  }
  await exercise.deleteOne();
  return { deleted: true, usage };
}

/** Library entries for a set of ids, keyed by id (archived ones included: plans may still use them). */
export async function exercisesById(ids) {
  const unique = [...new Set(ids.map(String))];
  const docs = await Exercise.find({ _id: { $in: unique } })
    .select('name primaryMuscle equipment category instructions videoUrl archived')
    .lean();
  return new Map(docs.map((d) => [String(d._id), d]));
}
