import { z } from 'zod';
import { money, optionalText } from './common.js';

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

/** Product photo: one uploaded here (/uploads/avatars/…), a file the site ships (/images/…) or an https link. */
const productImage = z
  .string()
  .trim()
  .min(1, 'Add a photo of the product')
  .max(1000)
  .refine((v) => /^\/(uploads\/avatars|images)\/[\w./-]+$/.test(v) || /^https:\/\/\S+$/.test(v), 'Upload a photo, or paste a link starting with https://');

const productFields = {
  name: z.string().trim().min(1, 'Name the product').max(120),
  category: z.enum(['protein', 'preworkout', 'vitamins', 'accessories'], { errorMap: () => ({ message: 'Choose a category' }) }),
  price: money,
  // Sale price; null (from the edit form) removes it.
  discountPrice: money.nullable().optional(),
  rating: z.coerce.number().min(0).max(5, 'Rating is out of 5').optional(),
  image: productImage,
  badge: optionalText(40),
  description: optionalText(1000),
  stock: z.coerce.number().int('Whole numbers only').min(0, 'Stock can’t be negative').default(0),
  showOnFrontend: bool.default(true),
  sku: z.string().trim().min(1, 'Add the SKU (stock code)').max(60),
  brand: z.string().trim().min(1, 'Add the brand').max(80),
};

const saleBelowPrice = (p) => p.discountPrice == null || p.price == null || p.discountPrice < p.price;
const saleMessage = { message: 'The sale price must be lower than the price', path: ['discountPrice'] };

export const productSchema = z.object(productFields).refine(saleBelowPrice, saleMessage);
export const productPatchSchema = z.object(productFields).partial().refine(saleBelowPrice, saleMessage);

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: optionalText(20),
  message: z.string().trim().min(1, 'Write a message').max(3000),
});
