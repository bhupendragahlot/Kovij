import { z } from 'zod';
import { dayKey, objectId, pagination } from './common.js';
import { EXTEND_POLICY, FREEZE_POLICY } from '../services/membershipService.js';

const addressSchema = z.object({
  city: z.string().min(1),
  state: z.string().min(1),
  line1: z.string().optional(),
});

const personalDetailsSchema = z.object({
  fullName: z.string().min(1),
  age: z.coerce.number().int().min(1).max(120),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_say']),
  mobile: z.string().min(5),
  email: z.string().email(),
  address: addressSchema,
});

const healthDetailsSchema = z.object({
  heightCm: z.coerce.number().positive(),
  weightKg: z.coerce.number().positive(),
  bloodGroup: z.string().optional(),
  medicalCondition: z.object({
    has: z.coerce.boolean(),
    details: z.string().optional(),
  }),
  injuries: z.string().optional(),
  allergies: z.string().optional(),
});

const fitnessGoalSchema = z.object({
  goalKind: z.enum(['weight_loss', 'weight_gain', 'muscle_building', 'general_fitness', 'other']),
  customText: z.string().optional(),
});

/**
 * Online self-join. Fees and payment status are deliberately NOT accepted from the member:
 * the server prices the plan and the desk confirms payment.
 */
export const joinMembershipSchema = z.object({
  personalDetails: personalDetailsSchema,
  healthDetails: healthDetailsSchema,
  fitnessGoal: fitnessGoalSchema,
  selectedPlanId: z.string().min(1),
  profilePhotoUrl: z.string().max(300).optional(),
  idProofUrl: z.string().max(300).optional(),
  idProofType: z.enum(['aadhar', 'pan', 'passport', 'driving_license', 'other']).optional(),
});

export const updateMembershipSchema = z.object({
  newPlanId: z.string().min(1),
  changeType: z.enum(['upgrade', 'downgrade', 'renew']).optional(),
});

// ── Staff: freeze, extend, renewals (/api/admin/memberships) ────────────────

const reason = z.string().trim().min(3, 'Add a short reason').max(200);

export const freezeSchema = z.object({
  /** First day on hold, `YYYY-MM-DD` in gym time; today when left out. */
  startDate: dayKey.optional(),
  days: z.coerce
    .number({ invalid_type_error: 'Enter the number of days' })
    .int('Use whole days')
    .min(FREEZE_POLICY.minDays, `At least ${FREEZE_POLICY.minDays} day`)
    .max(FREEZE_POLICY.maxDays, `At most ${FREEZE_POLICY.maxDays} days`),
  reason,
});

export const unfreezeSchema = z.object({}).strip();

export const extendSchema = z.object({
  days: z.coerce
    .number({ invalid_type_error: 'Enter the number of days' })
    .int('Use whole days')
    .min(EXTEND_POLICY.minDays, `At least ${EXTEND_POLICY.minDays} day`)
    .max(EXTEND_POLICY.maxDays, `At most ${EXTEND_POLICY.maxDays} days`),
  reason,
});

export const endingQuery = z.object({
  within: z.coerce.number().int().min(1).max(60).default(7),
  ...pagination,
});

export const lapsedQuery = z.object({
  /** Ended in the last N days. */
  since: z.coerce.number().int().min(1).max(730).default(60),
  ...pagination,
});

export const renewalHistoryQuery = z.object({
  since: z.coerce.number().int().min(1).max(730).default(30),
  type: z.enum(['all', 'renew', 'upgrade', 'downgrade']).default('all'),
  ...pagination,
});

/** Test-only clock for the freeze roll-over (route exists only when NODE_ENV=test). */
export const settleTestSchema = z.object({ now: z.coerce.date() });

// ── Member app (/api/member/membership) ─────────────────────────────────────

export const memberPlanRequestSchema = z.object({ planId: objectId });

export const memberRequestParams = z.object({ id: objectId });

export const memberHistoryQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(100) });
