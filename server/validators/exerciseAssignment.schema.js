import { z } from 'zod';
import { objectId, optionalText, pagination } from './common.js';
import { LIMITS } from '../services/training/constants.js';
import { realDay } from './workout.schema.js';

/** ExerciseDB filter values are short words ("upper legs", "leverage machine"). */
const filterValue = z
  .string()
  .trim()
  .max(60)
  .regex(/^[\p{L}\p{N} '&./()-]*$/u, 'Use letters and numbers only')
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** ExerciseDB ids: "EIeI8Vf" (free), "edb_T5uXtLj" (paid), "exr_41n2…" (v2). */
export const exerciseDbId = z.string().trim().regex(/^[A-Za-z0-9_-]{3,64}$/, 'Not an ExerciseDB exercise id');

export const exerciseDbSearchQuery = z.object({
  q: filterValue,
  bodyPart: filterValue,
  muscle: filterValue,
  equipment: filterValue,
  type: filterValue,
  after: exerciseDbId.optional(),
  limit: z.coerce.number().int().min(1).max(25).default(24),
});

export const exerciseDbIdParam = z.object({ exerciseDbId });

/** '' and null mean "not set" from a form; numbers arrive as strings from inputs. */
const optionalNumber = (min, max, message, { int = false } = {}) => {
  const n = int ? z.coerce.number().int('Whole numbers only') : z.coerce.number();
  return z.preprocess((v) => (v === '' ? undefined : v), z.union([z.null(), n.min(min, message).max(max, message)]).optional());
};

const prescription = {
  sets: optionalNumber(1, LIMITS.setsPerExercise, `1 to ${LIMITS.setsPerExercise} sets`, { int: true }),
  reps: z.string().trim().max(20, 'Keep reps short, e.g. 8-12').optional(),
  durationSec: optionalNumber(1, 7200, 'Up to 2 hours'),
  restSec: optionalNumber(0, 900, 'Rest up to 15 minutes'),
  weightKg: optionalNumber(0, 1000, 'Check the weight'),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters').optional(),
};

const item = z
  .object({ exerciseDbId, ...prescription })
  .refine((i) => i.sets || i.durationSec, { message: 'Add sets and reps, or a time', path: ['sets'] })
  .transform((i) => ({ ...i, sets: i.sets ?? undefined, durationSec: i.durationSec ?? undefined, restSec: i.restSec ?? undefined, weightKg: i.weightKg ?? undefined }));

export const assignExercisesSchema = z.object({
  date: realDay,
  repeatWeeks: z.coerce.number().int().min(1).max(LIMITS.assignRepeatWeeks, `Repeat for up to ${LIMITS.assignRepeatWeeks} weeks`).default(1),
  items: z.array(item).min(1, 'Add at least one exercise').max(LIMITS.exercisesPerAssign, `Up to ${LIMITS.exercisesPerAssign} exercises at a time`),
  notify: z.boolean().default(true),
});

export const updateExerciseAssignmentSchema = z
  .object({ date: realDay, ...prescription })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { message: 'Nothing to change' });

export const completeExerciseSchema = z.object({ memberNote: optionalText(500) }).default({});

export const memberParam = z.object({ memberId: objectId });

export const historyQuery = z.object({
  status: z.enum(['done', 'missed', 'past']).default('done'),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const overviewQuery = z.object({
  from: realDay.optional(),
  to: realDay.optional(),
  trainerId: z.union([objectId, z.literal('none')]).optional(),
  memberId: objectId.optional(),
  status: z.enum(['all', 'todo', 'done', 'missed', 'cancelled']).default('all'),
  ...pagination,
});
