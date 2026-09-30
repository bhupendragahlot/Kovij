import { z } from 'zod';
import { dayKey, money, objectId, optionalEmail, optionalText, pagination, paymentMode, phone } from './common.js';
import { gymDayKey } from '../utils/time.js';

/** Gym-day date that can't be in the future (joining date). */
const pastDay = dayKey.refine((v) => v <= gymDayKey(), 'Can’t be in the future').refine((v) => v >= '1990-01-01', 'Check the year');

const memberFilters = {
  q: optionalText(100),
  state: z.enum(['all', 'active', 'expiring', 'paused', 'upcoming', 'pending', 'expired', 'none', 'dues']).default('all'),
  sort: z.enum(['recent', 'name', 'ending', 'joined']).optional(),
  joinedFrom: dayKey.optional(),
  joinedTo: dayKey.optional(),
  trainerId: z.union([z.literal('none'), objectId]).optional(),
};
const joinedRangeOk = (v) => !v.joinedFrom || !v.joinedTo || v.joinedFrom <= v.joinedTo;
const joinedRangeError = { message: 'The start date must be before the end date', path: ['joinedTo'] };

export const listMembersQuery = z.object({ ...memberFilters, ...pagination }).refine(joinedRangeOk, joinedRangeError);

export const exportMembersQuery = z.object(memberFilters).refine(joinedRangeOk, joinedRangeError);

export const referralSchema = z.object({
  channel: z.enum(['friend', 'instagram', 'google', 'walk_in', 'website', 'other']).optional(),
  referredByMemberId: objectId.optional(),
  referredByName: optionalText(120),
});

export const memberDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone,
  email: optionalEmail,
  gender: z.enum(['male', 'female', 'other', 'prefer_not_say']).optional(),
  dob: z.coerce.date().optional(),
  address: z
    .object({ line1: optionalText(200), city: optionalText(80), state: optionalText(80) })
    .optional(),
  emergencyContact: z
    .object({
      name: optionalText(120),
      phone: optionalText(20).refine((v) => !v || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number'),
    })
    .optional(),
  notes: optionalText(2000),
  /** `YYYY-MM-DD`; defaults to today at registration. */
  joinedAt: pastDay.optional(),
  /** `null` clears it when editing. */
  referral: referralSchema.nullable().optional(),
});

export const healthSchema = z
  .object({
    heightCm: z.coerce.number().positive().max(260).optional(),
    weightKg: z.coerce.number().positive().max(400).optional(),
    bloodGroup: optionalText(5),
    medicalHas: z.boolean().optional(),
    medicalDetails: optionalText(1000),
    injuries: optionalText(1000),
    allergies: optionalText(1000),
    goalKind: z.enum(['weight_loss', 'weight_gain', 'muscle_building', 'general_fitness', 'other']).optional(),
    goalCustomText: optionalText(300),
  })
  .optional();

export const salePaymentSchema = z
  .object({
    collect: z.enum(['now', 'later']),
    mode: paymentMode.optional(),
    txnRef: optionalText(80),
  })
  .refine((p) => p.collect === 'later' || p.mode, { message: 'Choose how the member paid', path: ['mode'] });

export const saleSchema = z.object({
  planId: objectId,
  start: z.enum(['auto', 'today', 'after_current']).default('auto'),
  priceOverride: money.optional(),
  chargeRegistration: z.union([z.literal('auto'), z.boolean()]).default('auto'),
  payment: salePaymentSchema,
});

export const createMemberSchema = z.object({
  details: memberDetailsSchema,
  health: healthSchema,
  membership: saleSchema.optional(),
  force: z.boolean().default(false),
});

export const updateMemberSchema = z.object({
  details: memberDetailsSchema.partial().optional(),
  health: healthSchema,
});

export const notifyMemberSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  bodyHtml: z.string().trim().min(1).max(20000),
});

export const duplicateCheckQuery = z.object({
  phone: optionalText(20),
  email: optionalText(120),
  excludeId: objectId.optional(),
});

export const cancelMembershipSchema = z.object({ reason: optionalText(200) });

export const membershipParams = z.object({ id: objectId, membershipId: objectId });
