import { z } from 'zod';
import { dayKey, objectId, optionalText, pagination } from './common.js';
import { LIMITS, PLAN_GOALS, PLAN_LEVELS } from '../services/training/constants.js';
import { parseGymDay } from '../utils/time.js';

/** A real calendar day (rejects 2026-02-31), YYYY-MM-DD in gym time. */
export const realDay = dayKey.refine((v) => parseGymDay(v).isValid() && parseGymDay(v).format('YYYY-MM-DD') === v, {
  message: 'Choose a real date',
});

const optionalWeight = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.coerce.number().min(0, 'Weight cannot be negative').max(1000, 'Check the weight').optional()
);

const planExercise = z.object({
  exerciseId: objectId,
  sets: z.coerce.number().int().min(1, 'At least 1 set').max(LIMITS.setsPerExercise, `Up to ${LIMITS.setsPerExercise} sets`),
  reps: z.string().trim().min(1, 'Add reps, e.g. 8-12').max(20, 'Keep reps short, e.g. 8-12'),
  weightKg: optionalWeight,
  restSec: z.coerce.number().int().min(0).max(900, 'Rest up to 15 minutes').default(60),
  notes: optionalText(300),
});

const planDay = z.object({
  name: z.string().trim().min(1, 'Name this day').max(60),
  exercises: z.array(planExercise).max(LIMITS.exercisesPerDay, `Up to ${LIMITS.exercisesPerDay} exercises a day`),
});

const days = z.array(planDay).min(1, 'Add at least one day').max(LIMITS.daysPerPlan, `Up to ${LIMITS.daysPerPlan} days`);

export const planSchema = z.object({
  name: z.string().trim().min(1, 'Name the plan').max(120),
  goal: z.enum(PLAN_GOALS).default('general_fitness'),
  level: z.enum(PLAN_LEVELS).default('beginner'),
  daysPerWeek: z.coerce.number().int().min(1, 'At least 1 day a week').max(7, 'Up to 7 days a week').default(3),
  days,
  notes: optionalText(2000),
});

export const planPatchSchema = z
  .object({
    name: planSchema.shape.name,
    goal: z.enum(PLAN_GOALS),
    level: z.enum(PLAN_LEVELS),
    daysPerWeek: z.coerce.number().int().min(1).max(7),
    days,
    notes: optionalText(2000),
    archived: z.boolean(),
  })
  .partial();

export const listPlansQuery = z.object({
  q: optionalText(100),
  goal: z.enum(['all', ...PLAN_GOALS]).default('all'),
  level: z.enum(['all', ...PLAN_LEVELS]).default('all'),
  status: z.enum(['active', 'archived']).default('active'),
  ...pagination,
});

export const assignPlanSchema = z.object({
  memberIds: z
    .array(objectId)
    .min(1, 'Choose at least one member')
    .max(LIMITS.membersPerAssign, `Assign to up to ${LIMITS.membersPerAssign} members at a time`)
    .transform((ids) => [...new Set(ids)]),
  startDate: realDay.optional(),
  notes: optionalText(1000),
  notify: z.boolean().default(true),
});

export const updateAssignmentSchema = z
  .object({
    name: planSchema.shape.name,
    notes: optionalText(2000),
    daysPerWeek: z.coerce.number().int().min(1).max(7),
    startDate: realDay,
    days,
    notify: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).some((k) => k !== 'notify'), { message: 'Nothing to change' });

export const endAssignmentSchema = z.object({ note: optionalText(300) });

const logSet = z.object({
  reps: z.coerce.number().int('Reps must be a whole number').min(0).max(500),
  weightKg: z.preprocess((v) => (v === '' || v === null || v === undefined ? 0 : v), z.coerce.number().min(0).max(1000)),
  done: z.boolean().default(true),
});

export const logSchema = z
  .object({
    date: realDay.optional(),
    dayIndex: z.coerce.number().int().min(0).max(LIMITS.daysPerPlan - 1).default(0),
    entries: z
      .array(z.object({ exerciseId: objectId, sets: z.array(logSet).min(1, 'Add at least one set').max(LIMITS.setsPerExercise) }))
      .min(1, 'Add at least one exercise')
      .max(LIMITS.exercisesPerDay),
    notes: optionalText(1000),
  })
  .refine((v) => v.entries.some((e) => e.sets.some((s) => s.done && s.reps > 0)), {
    message: 'Tick at least one set that was finished',
    path: ['entries'],
  });

export const pageQuery = z.object(pagination);

export const rosterQuery = z.object({
  /** "mine" = members of the signed-in trainer, "all", or a trainer id. */
  who: z.union([z.enum(['mine', 'all', 'none']), objectId]).default('all'),
  plan: z.enum(['all', 'on_plan', 'no_plan']).default('all'),
  q: optionalText(100),
  ...pagination,
});

export const memberParam = z.object({ memberId: objectId });
export const memberExerciseParams = z.object({ memberId: objectId, exerciseId: objectId });
export const exerciseParam = z.object({ exerciseId: objectId });
