import { z } from 'zod';
import { money, optionalEmail, optionalText } from './common.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour');

/** Shown in the app, emails and receipts: only https links or our own uploaded images. */
const imageLink = optionalText(1000).refine((v) => v === undefined || /^(https:\/\/|\/uploads\/avatars\/)/i.test(v), 'Use a link starting with https://');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Each weekday once; sessions start before they end and don't overlap; open days have hours. */
export function checkOpeningHours(days, ctx) {
  const seen = new Set();
  days.forEach((d, i) => {
    const name = DAY_NAMES[d.day];
    if (seen.has(d.day)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, 'day'], message: `${name} is listed twice` });
    seen.add(d.day);
    if (d.closed) return;
    if (!d.slots.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, 'slots'], message: `${name}: add opening hours or mark it closed` });
    d.slots.forEach((slot, j) => {
      if (slot.open >= slot.close) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, 'slots', j, 'close'], message: `${name}: closing time must be after opening time` });
    });
    const sorted = [...d.slots].sort((a, b) => a.open.localeCompare(b.open));
    for (let k = 1; k < sorted.length; k += 1) {
      if (sorted[k].open < sorted[k - 1].close) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, 'slots'], message: `${name}: the two sessions overlap` });
    }
  });
}

/** Gym profile, website content, hours, payments and reminder settings. Every field optional (PATCH). */
export const settingsSchema = z
  .object({
    gymName: optionalText(120),
    logoUrl: imageLink,
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
    openingHours: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          closed: z.boolean().default(false),
          slots: z.array(z.object({ open: time, close: time })).max(2, 'Up to 2 sessions a day').default([]),
        })
      )
      .max(7)
      .superRefine(checkOpeningHours),
    holidays: z
      .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), name: z.string().trim().min(1, 'Name the holiday').max(80) }))
      .max(100, 'Up to 100 holidays')
      .refine((list) => new Set(list.map((h) => h.date)).size === list.length, 'Each date can only be listed once'),
    payments: z
      .object({
        upiId: optionalText(80),
        payeeName: optionalText(80),
        onlineEnabled: z.boolean(),
        acceptCash: z.boolean(),
        acceptUpi: z.boolean(),
        acceptCard: z.boolean(),
        allowPartial: z.boolean(),
      })
      .partial(),
    reminders: z
      .object({
        enabled: z.boolean(),
        expiryDaysBefore: z.array(z.number().int().min(1).max(60)).max(6),
        onExpiryDay: z.boolean(),
        afterExpiryDays: z.array(z.number().int().min(1).max(90)).max(6),
        paymentDue: z.boolean(),
        paymentDueEveryDays: z.number().int().min(1).max(30),
        birthday: z.boolean(),
        sendHour: z.number().int().min(6).max(21),
      })
      .partial(),
    memberSignIn: z.object({ mobileOtp: z.boolean(), google: z.boolean() }).partial(),
  })
  .partial();

/** POST /api/admin/settings/email/test — empty `to` sends to the signed-in staff member. */
export const testEmailSchema = z.object({ to: optionalEmail });
