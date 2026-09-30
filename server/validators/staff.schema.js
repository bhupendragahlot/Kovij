import { z } from 'zod';

const role = z.enum(['admin', 'manager', 'staff', 'trainer']);
const password = z.string().min(8, 'Use at least 8 characters').max(128);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  username: z.string().trim().min(3, 'Use at least 3 characters').max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dots, dashes only'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role,
  password,
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: role.optional(),
  isActive: z.boolean().optional(),
  password: password.optional(),
});
