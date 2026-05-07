import { z } from 'zod';

const addressSchema = z
  .object({
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    line1: z.string().optional(),
  })
  .optional();

export const updateMemberProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  dob: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_say']).optional(),
  address: addressSchema,

  // health/profile
  heightCm: z.coerce.number().positive().optional(),
  weightKg: z.coerce.number().positive().optional(),
  bloodGroup: z.string().optional(),
  medicalHas: z.coerce.boolean().optional(),
  medicalDetails: z.string().optional(),
  injuries: z.string().optional(),
  allergies: z.string().optional(),
  goalKind: z
    .enum(['weight_loss', 'weight_gain', 'muscle_building', 'general_fitness', 'other'])
    .optional(),
  goalCustomText: z.string().optional(),
});

