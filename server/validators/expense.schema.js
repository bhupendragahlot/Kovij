import { z } from 'zod';
import { money, optionalText, pagination } from './common.js';
import { calendarDay } from './payment.schema.js';
import { EXPENSE_CATEGORIES, EXPENSE_MODES } from '../models/Expense.js';
import { parseGymDay, toGymTime } from '../utils/time.js';

const blank = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
/** Expenses are recorded when paid, so a date in the future is almost always a typo. */
const pastDay = calendarDay.refine((d) => !parseGymDay(d).isAfter(toGymTime(), 'day'), 'The date can’t be in the future');

export const listExpensesQuery = z.object({
  month: blank(month.optional()),
  category: blank(z.enum(EXPENSE_CATEGORIES).optional()),
  q: optionalText(100),
  ...pagination,
});

export const exportExpensesQuery = z.object({
  month: blank(month.optional()),
  category: blank(z.enum(EXPENSE_CATEGORIES).optional()),
  q: optionalText(100),
});

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: 'Choose what the money was for' }) }),
  amount: money.refine((n) => n > 0, 'Amount must be more than 0'),
  date: pastDay,
  mode: z.enum(EXPENSE_MODES).default('cash'),
  vendor: optionalText(120),
  note: optionalText(500),
});

export const updateExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    amount: money.refine((n) => n > 0, 'Amount must be more than 0'),
    date: pastDay,
    mode: z.enum(EXPENSE_MODES),
    // "" clears the field on edit.
    vendor: z.string().trim().max(120),
    note: z.string().trim().max(500),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Change at least one field');
