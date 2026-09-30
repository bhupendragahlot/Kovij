import { z } from 'zod';
import { objectId, optionalEmail, optionalText, pagination } from './common.js';
import { LIMITS } from '../services/training/constants.js';
import { scheduleProblems } from '../services/training/math.js';

const bool = z.boolean();

/** Links and photos render in pages and emails: only web links or our own upload paths. */
const safeLink = (max, message) =>
  optionalText(max).refine((v) => v === undefined || /^(https?:\/\/|\/uploads\/)/i.test(v), { message });

const clock = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 06:30');

export const scheduleSchema = z
  .array(
    z.object({
      day: z.coerce.number().int().min(0).max(6),
      shifts: z.array(z.object({ start: clock, end: clock })).max(LIMITS.shiftsPerDay, `Up to ${LIMITS.shiftsPerDay} shifts a day`),
    })
  )
  .max(7)
  .superRefine((days, ctx) => {
    for (const p of scheduleProblems(days)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: p.path, message: p.message });
  });

export const trainerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.string().trim().min(1, 'Title is required').max(80),
  image: safeLink(1000, 'Use a photo link starting with https://'),
  instagram: safeLink(300, 'Use the full Instagram link, starting with https://'),
  description: optionalText(1000),
  phone: optionalText(20).refine((v) => v === undefined || /^\+?[0-9 ()-]{7,20}$/.test(v), { message: 'Enter a valid phone number' }),
  email: optionalEmail,
  specialties: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  shift: optionalText(120),
  schedule: scheduleSchema.default([]),
  /** Staff login with the trainer role; null unlinks. */
  userId: objectId.nullable().optional(),
  isActive: bool.default(true),
  showOnFrontend: bool.default(true),
});

/** PATCH: only the fields sent are changed (no defaults filled in). */
export const trainerPatchSchema = trainerSchema
  .extend({ specialties: z.array(z.string().trim().min(1).max(60)).max(12), schedule: scheduleSchema, isActive: bool, showOnFrontend: bool })
  .partial();

export const assignMembersSchema = z.object({
  memberIds: z
    .array(objectId)
    .min(1, 'Choose at least one member')
    .max(200, 'Assign up to 200 members at a time')
    .transform((ids) => [...new Set(ids)]),
});

export const trainerMembersQuery = z.object({
  q: optionalText(100),
  ...pagination,
});

export const trainerMemberParams = z.object({ id: objectId, memberId: objectId });
