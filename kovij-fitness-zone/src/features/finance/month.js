import { gymDayKey } from "../../shared/lib/format";

const monthYearFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
const dayMonthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

/** "2026-09" for the gym's current month. */
export const currentMonth = () => gymDayKey().slice(0, 7);

/** "2026-09" + 1 → "2026-10" */
export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "September 2026" */
export const monthLabel = (month) => monthYearFmt.format(new Date(`${month}-01T00:00:00Z`));

/** "2026-09-04" → "4 Sept" */
export const dayLabel = (day) => dayMonthFmt.format(new Date(`${day}T00:00:00Z`));

export const isValidMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");
