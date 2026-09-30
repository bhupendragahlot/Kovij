import { z } from 'zod';
import { money, optionalEmail, optionalText } from './common.js';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM, 24-hour');

/** Gym profile, website content, hours, payments and reminder settings. Every field optional (PATCH). */
export const settingsSchema = z
  .object({
    gymName: optionalText(120),
    logoUrl: optionalText(1000),
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
          slots: z.array(z.object({ open: time, close: time })).max(4).default([]),
        })
      )
      .max(7),
    holidays: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: z.string().trim().min(1).max(80) })).max(100),
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
  })
  .partial();
