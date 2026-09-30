/**
 * Display formatting for the Indian gym context. Every date is shown in gym time (IST),
 * whatever the device's clock is set to.
 */
export const GYM_TZ = "Asia/Kolkata";
const LOCALE = "en-IN";

const inr = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat(LOCALE);
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: GYM_TZ, hour: "numeric", minute: "2-digit", hour12: true });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, weekday: "long", day: "numeric", month: "long" });
const monthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: GYM_TZ, month: "short" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-IN", { timeZone: GYM_TZ, hour: "numeric", hour12: false });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const toDate = (value) => (value instanceof Date ? value : new Date(value));
const valid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

export const formatINR = (n) => inr.format(Number(n) || 0);
export const formatINRCompact = (n) => inrCompact.format(Number(n) || 0);
export const formatNumber = (n) => num.format(Number(n) || 0);

export function formatDate(value) {
  if (!value) return "";
  const d = toDate(value);
  return valid(d) ? dateFmt.format(d) : "";
}

export function formatShortDate(value) {
  if (!value) return "";
  const d = toDate(value);
  return valid(d) ? shortDateFmt.format(d) : "";
}

export function formatTime(value) {
  if (!value) return "";
  const d = toDate(value);
  return valid(d) ? timeFmt.format(d).replace(" ", " ") : "";
}

export function formatDateTime(value) {
  if (!value) return "";
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export const formatLongToday = (now = new Date()) => weekdayFmt.format(now);
export const formatMonth = (yyyyMm) => monthFmt.format(new Date(`${yyyyMm}-15T00:00:00Z`));

/** "2026-09-30" for the gym's current calendar day. */
export const gymDayKey = (value = new Date()) => dayKeyFmt.format(toDate(value));

/** Whole gym-calendar days from today until `value` (negative when in the past). */
export function daysUntil(value, now = new Date()) {
  if (!value) return null;
  const a = Date.parse(`${gymDayKey(now)}T00:00:00Z`);
  const b = Date.parse(`${gymDayKey(value)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "today", "tomorrow", "in 5 days", "3 days ago" */
export function formatRelativeDay(value, now = new Date()) {
  const days = daysUntil(value, now);
  if (days == null) return "";
  return relative.format(days, "day");
}

/** "just now", "12 min ago", "3 hr ago", then a date. */
export function formatRelativeTime(value, now = new Date()) {
  if (!value) return "";
  const diffSec = Math.round((toDate(value) - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return "just now";
  if (abs < 3600) return relative.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86_400 * 6) return relative.format(Math.round(diffSec / 86_400), "day");
  return formatDate(value);
}

export function greeting(now = new Date()) {
  const hour = Number(hourFmt.format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "6 am", "12 pm" for chart axes */
export function formatHour(hour) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

export function initials(name = "") {
  // Letters only, so "Neha <b>" or "Dr. A. Rao" still give sensible initials.
  const parts = String(name)
    .split(/\s+/)
    .map((p) => p.match(/\p{L}/u)?.[0])
    .filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0] + (parts.length > 1 ? parts[parts.length - 1] : "")).toUpperCase();
}

export const pluralize = (n, one, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/** "9876543210" → "98765 43210" (the server stores Indian numbers as 10 digits). */
export function formatPhone(phone) {
  if (!phone) return "";
  const s = String(phone);
  return /^\d{10}$/.test(s) ? `${s.slice(0, 5)} ${s.slice(5)}` : s;
}

/** Digits-only phone for tel:/wa.me links; assumes India when no country code is given. */
export function phoneHref(phone, kind = "tel") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return kind === "whatsapp" ? `https://wa.me/${intl}` : `tel:+${intl}`;
}

/** Deterministic JSON (sorted keys): used to detect "same request" for idempotency keys. */
export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}
