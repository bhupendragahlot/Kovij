import { z } from 'zod';
import { dayKey, objectId, pagination } from './common.js';
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_CATEGORIES } from '../models/Announcement.js';
import { REMINDER_KINDS, REMINDER_POLICY } from '../services/reminderRules.js';
import { isAllowedPushEndpoint } from '../services/pushChannel.js';

/** OWNER: engagement module (reminders, notifications, announcements, push). */

const dayList = (max, label) =>
  z
    .array(z.number({ invalid_type_error: 'Use whole days' }).int('Use whole days').min(1, 'Use 1 day or more').max(max, `Use ${max} days or fewer`))
    .max(REMINDER_POLICY.maxDayOptions, `Pick up to ${REMINDER_POLICY.maxDayOptions} ${label}`)
    .transform((list) => [...new Set(list)].sort((a, b) => a - b));

export const reminderSettingsSchema = z
  .object({
    enabled: z.boolean(),
    expiryDaysBefore: dayList(REMINDER_POLICY.maxDaysBefore, 'reminder days'),
    onExpiryDay: z.boolean(),
    afterExpiryDays: dayList(REMINDER_POLICY.maxDaysAfter, 'follow-up days'),
    paymentDue: z.boolean(),
    paymentDueEveryDays: z.number().int().min(1, 'Use 1 day or more').max(30, 'Use 30 days or fewer'),
    birthday: z.boolean(),
    sendHour: z.number().int().min(6, 'Pick a time between 6 am and 9 pm').max(21, 'Pick a time between 6 am and 9 pm'),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to save' });

export const previewQuery = z.object({ date: dayKey.optional() });

export const statsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

const logFilters = {
  kind: z.string().trim().regex(/^[a-z_]{2,40}$/, 'Unknown kind').optional(),
  memberId: objectId.optional(),
  from: dayKey.optional(),
  to: dayKey.optional(),
  problems: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ...pagination,
};

export const notificationLogQuery = z
  .object({ group: z.enum(['reminders', 'announcements', 'messages', 'other']).optional(), ...logFilters })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'The start date must be before the end date', path: ['to'] });

export const reminderHistoryQuery = z.object({ ...logFilters, kind: z.enum(REMINDER_KINDS).optional() });

/** Test-only: run jobs as of a chosen moment, optionally for a few members only. */
export const testRunSchema = z.object({
  now: z.coerce.date(),
  jobs: z.array(z.enum(['reminders', 'preview', 'announcements', 'housekeeping'])).min(1).default(['reminders']),
  memberIds: z.array(objectId).max(50).optional(),
});

// ── Announcements ────────────────────────────────────────────────────────────

const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https:\/\/[^\s"'<>]+$/i.test(v), 'Use an https:// image link')
  .transform((v) => v || '');

// null first: z.coerce.date() would turn null into 1 Jan 1970.
const optionalDate = z.union([z.null(), z.coerce.date({ errorMap: () => ({ message: 'Pick a valid date and time' }) })]).optional();

const announcementFields = {
  title: z.string().trim().min(1, 'Add a title').max(120, 'Keep the title under 120 characters').regex(/^[^\r\n]*$/, 'Keep the title on one line'),
  body: z.string().trim().min(1, 'Write the announcement').max(2000, 'Keep it under 2,000 characters'),
  category: z.enum(ANNOUNCEMENT_CATEGORIES, { errorMap: () => ({ message: 'Pick a category' }) }),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES, { errorMap: () => ({ message: 'Pick who should see it' }) }),
  imageUrl: httpsUrl,
  pinned: z.boolean(),
  publishAt: optionalDate,
  expiresAt: optionalDate,
  sendEmail: z.boolean(),
};

export const createAnnouncementSchema = z.object({
  ...announcementFields,
  category: announcementFields.category.default('notice'),
  audience: announcementFields.audience.default('all'),
  imageUrl: httpsUrl.optional().default(''),
  pinned: z.boolean().default(false),
  sendEmail: z.boolean().default(false),
});

export const updateAnnouncementSchema = z
  .object(announcementFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to save' });

export const listAnnouncementsQuery = z.object({
  status: z.enum(['all', 'live', 'scheduled', 'draft', 'unpublished', 'ended']).default('all'),
  ...pagination,
});

export const audienceQuery = z.object({ audience: z.enum(ANNOUNCEMENT_AUDIENCES).default('all') });

// ── Staff messages ───────────────────────────────────────────────────────────

export const memberMessageSchema = z
  .object({
    memberId: objectId,
    title: z.string().trim().min(1, 'Add a subject').max(120, 'Keep the subject under 120 characters').regex(/^[^\r\n]*$/, 'Keep the subject on one line'),
    body: z.string().trim().min(1, 'Write a message').max(2000, 'Keep it under 2,000 characters'),
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    template: z.enum(['custom', 'payment_reminder', 'we_miss_you', 'plan_renewed', 'plan_ending']).default('custom'),
  })
  .strict();

export const memberIdParam = z.object({ memberId: objectId });

// ── Member app ───────────────────────────────────────────────────────────────

export const inboxQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const preferencesSchema = z
  .object({
    email: z.boolean(),
    push: z.boolean(),
    announcements: z.boolean(),
    birthday: z.boolean(),
    workoutUpdates: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to save' });

const base64url = (min, max) => z.string().trim().min(min).max(max).regex(/^[A-Za-z0-9_-]+={0,2}$/, 'Invalid key');

const pushEndpoint = z
  .string()
  .trim()
  .max(1000)
  .refine(isAllowedPushEndpoint, 'This browser’s push service is not supported');

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: pushEndpoint,
    expirationTime: z.union([z.number(), z.null()]).optional(),
    keys: z.object({ p256dh: base64url(40, 200), auth: base64url(8, 100) }),
  }),
});

export const pushUnsubscribeSchema = z.object({ endpoint: z.string().trim().min(1).max(1000) });

export const announcementIdParam = z.object({ id: objectId });
