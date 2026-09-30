import { z } from 'zod';
import { objectId, optionalText, pagination } from './common.js';
import { isValidDayKey, isValidMonthKey } from '../services/attendanceRules.js';

/** A real gym calendar day, e.g. 2026-09-30 (2026-02-30 is refused). */
const day = z.string().trim().refine(isValidDayKey, { message: 'Use a real date as YYYY-MM-DD' });
/** A calendar month, e.g. 2026-09. */
const month = z.string().trim().refine(isValidMonthKey, { message: 'Use a month as YYYY-MM' });

export const attendanceQuery = z.object({ date: day.optional(), memberId: objectId.optional() });

export const checkInSchema = z.object({
  memberId: objectId,
  override: z.boolean().default(false),
  overrideReason: optionalText(200),
  /** "qr" when the member was found by scanning their code at the desk. The kiosk uses /scan. */
  method: z.enum(['desk', 'qr']).default('desk'),
});

export const checkOutSchema = z.object({ method: z.enum(['desk', 'qr']).default('desk') });

export const scanSchema = z.object({
  code: z.string().trim().min(1, 'Scan a QR code or type a member code').max(200, 'This code is too long'),
  /** auto: check in, or check out when already in for a while; in / out: force one direction. */
  mode: z.enum(['auto', 'in', 'out']).default('auto'),
  /** kiosk: unattended, QR codes only, never lets anyone in without an active plan. */
  source: z.enum(['desk', 'kiosk']).default('desk'),
});

export const monthQuery = z.object({ month: month.optional() });

export const monthMembersQuery = z.object({ month: month.optional(), q: optionalText(100), ...pagination });

export const exportQuery = z.object({ month: month.optional(), kind: z.enum(['visits', 'members']).default('visits') });

export const memberParam = z.object({ memberId: objectId });

export const historyQuery = z.object({ ...pagination });

export const reissueQrSchema = z.object({ reason: optionalText(200) });
