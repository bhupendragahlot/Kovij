import { z } from 'zod';
import { money, optionalEmail, optionalText } from './common.js';

const bool = z.boolean();

export const planSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  price: money,
  duration: z.enum(['day', 'week', 'month', 'quarter', 'half_year', 'year']),
  durationInDays: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  description: optionalText(500),
  features: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  popular: bool.default(false),
  color: optionalText(120),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  showOnFrontend: bool.default(true),
});
export const planPatchSchema = planSchema.partial();

export const trainerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.string().trim().min(1, 'Title is required').max(80),
  image: optionalText(1000),
  instagram: optionalText(300),
  description: optionalText(1000),
  phone: optionalText(20),
  email: optionalEmail,
  specialties: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
  shift: optionalText(120),
  isActive: bool.default(true),
  showOnFrontend: bool.default(true),
});
export const trainerPatchSchema = trainerSchema.partial();

export const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(['protein', 'preworkout', 'vitamins', 'accessories']),
  price: money,
  discountPrice: money.optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  image: z.string().trim().min(1).max(1000),
  badge: optionalText(40),
  description: optionalText(1000),
  stock: z.coerce.number().int().min(0).default(0),
  showOnFrontend: bool.default(true),
  sku: z.string().trim().min(1).max(60),
  brand: z.string().trim().min(1).max(80),
});
export const productPatchSchema = productSchema.partial();

export const settingsSchema = z
  .object({
    gymName: optionalText(120),
    registrationFee: money,
    invoicePrefix: z.string().trim().regex(/^[A-Za-z]{1,8}$/, 'Use 1–8 letters'),
    expiringWindowDays: z.coerce.number().int().min(1).max(60),
    heroBackgroundImage: optionalText(1000),
    heroHeadline: optionalText(200),
    heroDescription: optionalText(500),
    address: optionalText(300),
    phone: optionalText(20),
    email: optionalEmail,
    facebook: optionalText(300),
    instagram: optionalText(300),
    whatsapp: optionalText(20),
    mapEmbedUrl: optionalText(2000),
  })
  .partial();

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: optionalText(20),
  message: z.string().trim().min(1, 'Write a message').max(3000),
});
