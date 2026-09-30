import { z } from 'zod';
import { optionalText } from './common.js';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLES } from '../services/training/constants.js';

const videoUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), { message: 'Paste the full video link, starting with https://' })
  .transform((v) => v || '')
  .optional();

export const exerciseSchema = z.object({
  name: z.string().trim().min(1, 'Name the exercise').max(120),
  primaryMuscle: z.enum(MUSCLES, { errorMap: () => ({ message: 'Choose the main muscle' }) }),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(6).default([]),
  equipment: z.enum(EQUIPMENT, { errorMap: () => ({ message: 'Choose the equipment' }) }),
  category: z.enum(EXERCISE_CATEGORIES).default('strength'),
  instructions: optionalText(2000),
  videoUrl,
});

export const exercisePatchSchema = exerciseSchema
  .extend({ secondaryMuscles: z.array(z.enum(MUSCLES)).max(6), category: z.enum(EXERCISE_CATEGORIES), archived: z.boolean() })
  .partial();

export const listExercisesQuery = z.object({
  q: optionalText(100),
  muscle: z.enum(['all', ...MUSCLES]).default('all'),
  equipment: z.enum(['all', ...EQUIPMENT]).default('all'),
  category: z.enum(['all', ...EXERCISE_CATEGORIES]).default('all'),
  status: z.enum(['active', 'archived']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
