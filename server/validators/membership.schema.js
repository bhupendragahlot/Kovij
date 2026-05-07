import { z } from 'zod';

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

const paymentPartSchema = z.object({
  registrationFee: z.coerce.number().min(0),
  membershipFee: z.coerce.number().min(0),
  mode: z.enum(['cash', 'upi', 'card']),
  status: z.enum(['paid', 'pending']),
});

export const joinMembershipSchema = z.object({
  personalDetails: personalDetailsSchema,
  healthDetails: healthDetailsSchema,
  fitnessGoal: fitnessGoalSchema,
  selectedPlanId: z.string().min(1),
  payment: paymentPartSchema,
  profilePhotoUrl: z.string().optional(),
  idProofUrl: z.string().optional(),
  idProofType: z.enum(['aadhar', 'pan', 'passport', 'driving_license', 'other']).optional(),
});

export const updateMembershipSchema = z.object({
  newPlanId: z.string().min(1),
  changeType: z.enum(['upgrade', 'downgrade', 'renew']).optional(),
});
