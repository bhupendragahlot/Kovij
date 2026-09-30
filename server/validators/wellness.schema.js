import { z } from 'zod';
import { objectId, pagination } from './common.js';
import { DIET_GOALS, DIET_TYPES } from '../models/DietPlan.js';
import { NOTE_CATEGORIES } from '../models/MemberNote.js';
import { PHOTO_POSES } from '../models/ProgressPhoto.js';
import { BODY_FIELDS, isRealDay } from '../services/wellnessMath.js';

/** Diet plans, nutrition logs, body progress and staff notes (wellness module). */

/** A real gym calendar day, YYYY-MM-DD. */
export const realDay = z.string().trim().refine(isRealDay, { message: 'Enter a date as YYYY-MM-DD' });

const amount = (max, what = 'a number') =>
  z
    .number({ invalid_type_error: `Enter ${what}` })
    .min(0, 'Must be 0 or more')
    .max(max, `Must be ${max} or less`);

/** A body measurement: optional, `null` clears it on edit. */
const measure = (min, max, unit) =>
  z
    .number({ invalid_type_error: 'Enter a number' })
    .min(min, `Enter a value from ${min} to ${max} ${unit}`)
    .max(max, `Enter a value from ${min} to ${max} ${unit}`)
    .nullable()
    .optional();

const mealTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 07:30')
  .or(z.literal(''))
  .optional()
  .default('');

// ── Diet plans ──────────────────────────────────────────────────────────────

export const foodItemSchema = z.object({
  food: z.string().trim().min(1, 'Enter the food').max(80, 'Keep it under 80 characters'),
  quantity: z.string().trim().max(60, 'Keep it under 60 characters').optional().default(''),
  /** Left empty, calories are worked out from the macros. */
  calories: amount(5000).nullable().optional(),
  proteinG: amount(500).optional().default(0),
  carbsG: amount(500).optional().default(0),
  fatG: amount(300).optional().default(0),
});

const mealSchema = z.object({
  name: z.string().trim().min(1, 'Name the meal').max(60),
  time: mealTime,
  items: z.array(foodItemSchema).max(30, 'Up to 30 items per meal').default([]),
});

const targetsSchema = z
  .object({
    calories: amount(10000).nullable().optional(),
    proteinG: amount(1000).nullable().optional(),
    carbsG: amount(1500).nullable().optional(),
    fatG: amount(500).nullable().optional(),
  })
  .default({});

export const dietPlanSchema = z.object({
  name: z.string().trim().min(2, 'Give the plan a name').max(100),
  goal: z.enum(DIET_GOALS).default('general_fitness'),
  dietType: z.enum(DIET_TYPES, { errorMap: () => ({ message: 'Choose veg, non-veg, eggetarian or vegan' }) }).default('veg'),
  targets: targetsSchema,
  meals: z.array(mealSchema).max(10, 'Up to 10 meals a day').default([]),
  notes: z.string().trim().max(2000).optional().default(''),
});

export const dietPlanPatchSchema = z
  .object({ archived: z.boolean() })
  .strict('Only archiving can be changed here. Save the whole plan to edit it.');

export const listDietPlansQuery = z.object({
  q: z.string().trim().max(80).optional(),
  dietType: z.enum(DIET_TYPES).optional(),
  archived: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const assignDietSchema = z.object({
  planId: objectId,
  /** Defaults to today. */
  startDay: realDay.optional(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters').optional().default(''),
});

// ── Nutrition log ───────────────────────────────────────────────────────────

export const mealTickSchema = z.object({ eaten: z.boolean({ required_error: 'Say whether the meal was eaten' }) });

export const extraItemSchema = foodItemSchema;

export const waterSchema = z.object({
  glasses: z.number({ invalid_type_error: 'Enter a number of glasses' }).int().min(0, 'Must be 0 or more').max(30, 'Up to 30 glasses a day'),
});

export const historyQuery = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });

export const dayParams = z.object({ day: realDay }).passthrough();
export const mealParams = z.object({ day: realDay, mealId: objectId }).passthrough();
export const itemParams = z.object({ day: realDay, itemId: objectId }).passthrough();

// ── Body progress ───────────────────────────────────────────────────────────

const measurementFields = {
  weightKg: measure(20, 300, 'kg'),
  heightCm: measure(90, 250, 'cm'),
  bodyFatPct: measure(2, 75, '%'),
  chestCm: measure(30, 250, 'cm'),
  waistCm: measure(30, 250, 'cm'),
  hipsCm: measure(30, 250, 'cm'),
  bicepsCm: measure(10, 80, 'cm'),
  thighsCm: measure(20, 120, 'cm'),
  neckCm: measure(20, 70, 'cm'),
  calvesCm: measure(15, 80, 'cm'),
  notes: z.string().trim().max(500, 'Keep the note under 500 characters').optional(),
};

export const measurementSchema = z
  .object({ day: realDay.optional(), ...measurementFields })
  .refine((d) => BODY_FIELDS.some((f) => d[f] != null), { message: 'Enter at least one measurement, such as weight', path: ['weightKg'] });

export const measurementPatchSchema = z
  .object({ day: realDay.optional(), ...measurementFields })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nothing to change', path: ['_'] });

export const photoFieldsSchema = z.object({
  day: realDay.optional(),
  pose: z.enum(PHOTO_POSES, { errorMap: () => ({ message: 'Choose front, side or back' }) }),
});

export const entryParams = z.object({ entryId: objectId }).passthrough();
export const photoParams = z.object({ photoId: objectId }).passthrough();
export const listEntriesQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(200) });

// ── Staff notes ─────────────────────────────────────────────────────────────

export const noteSchema = z.object({
  text: z.string().trim().min(1, 'Write the note').max(2000, 'Keep notes under 2000 characters'),
  category: z.enum(NOTE_CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }).default('general'),
  pinned: z.boolean().optional().default(false),
});

export const notePatchSchema = z
  .object({
    text: z.string().trim().min(1, 'Write the note').max(2000, 'Keep notes under 2000 characters').optional(),
    category: z.enum(NOTE_CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nothing to change', path: ['_'] });

export const listNotesQuery = z.object({
  category: z.enum(NOTE_CATEGORIES).optional(),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const noteParams = z.object({ noteId: objectId }).passthrough();
