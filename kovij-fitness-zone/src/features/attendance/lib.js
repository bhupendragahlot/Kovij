import { Ban, CircleCheck, CircleHelp, DoorOpen, LogIn, LogOut, QrCode, Undo2 } from "lucide-react";

/**
 * Attendance vocabulary and small helpers shared by the check-in page, attendance page, kiosk and
 * member tab. Day keys ("2026-09-30") are gym calendar days from the server; calendar maths is
 * done on the key itself, so the device's time zone never shifts a day.
 */

export const METHOD_LABEL = { desk: "Desk", qr: "QR at desk", kiosk: "Kiosk", self: "Member app" };

/** Visit status: icon + word + tone, never colour alone. */
export const VISIT_STATUS = {
  in: { tone: "good", icon: DoorOpen, label: "In gym" },
  out: { tone: "neutral", icon: CircleCheck, label: "Checked out" },
  no_check_out: { tone: "warn", icon: CircleHelp, label: "No check-out" },
};

/** Desk log entries. */
export const EVENT_META = {
  check_in: { icon: LogIn, label: "Checked in", tone: "good" },
  returned: { icon: LogIn, label: "Came back", tone: "good" },
  check_out: { icon: LogOut, label: "Checked out", tone: "neutral" },
  undo_check_in: { icon: Undo2, label: "Check-in undone", tone: "warn" },
  undo_check_out: { icon: Undo2, label: "Check-out undone", tone: "warn" },
  refused: { icon: Ban, label: "Refused entry", tone: "bad" },
  qr_reissued: { icon: QrCode, label: "New QR code", tone: "info" },
};

/** "45 min", "1 h", "1 h 5 min" */
export function formatDuration(minutes) {
  if (minutes == null) return "";
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

const keyToDate = (key) => new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`);
const utc = (opts) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts });
const monthLong = utc({ month: "long", year: "numeric" });
const monthShort = utc({ month: "short" });
const dayLong = utc({ weekday: "long", day: "numeric", month: "long" });
const dayShort = utc({ weekday: "short", day: "numeric", month: "short" });

export const formatMonthLong = (month) => monthLong.format(keyToDate(month));
export const formatMonthShort = (month) => monthShort.format(keyToDate(month));
export const formatDayLong = (key) => dayLong.format(keyToDate(key));
export const formatDayShort = (key) => dayShort.format(keyToDate(key));
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (key) => keyToDate(key).getUTCDay();
export const dayOfMonth = (key) => Number(key.slice(8, 10));
export const monthOf = (key) => key.slice(0, 7);

export function shiftDay(key, days) {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function shiftMonth(month, delta) {
  const d = keyToDate(month);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

/** "Priya S." for the shared kiosk screen: enough to recognise yourself, not a full name. */
export function shortName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Save text as a file (CSV exports). Adds the byte-order mark so Excel reads Hindi names. */
export function downloadText(text, filename, type = "text/csv;charset=utf-8") {
  const body = text.startsWith("\uFEFF") ? text : `\uFEFF${text}`;
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Who did it and how, for lists: "Kiosk", "Desk, Raj". */
export function recordedByLine(method, user) {
  const who = user?.name || user?.username;
  return [METHOD_LABEL[method] || method, who].filter(Boolean).join(", ");
}
