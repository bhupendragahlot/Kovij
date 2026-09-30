import { z } from 'zod';
import mongoose from 'mongoose';

export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: 'Invalid id' });

/** Optional text that treats '' as "not provided". */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === '' ? undefined : v));

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number');

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const money = z.coerce.number().min(0, 'Must be 0 or more').max(10_000_000);

export const paymentMode = z.enum(['cash', 'upi', 'card']);

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

/** `YYYY-MM-DD` */
export const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const idParam = z.object({ id: objectId });
