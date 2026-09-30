/** Small date helpers for plan dialogs. Day keys are `YYYY-MM-DD` in gym time (see shared/lib/format). */
const DAY = 86_400_000;

/** `YYYY-MM-DD` + n calendar days. */
export const addDaysToKey = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Start of a gym day as a Date (Asia/Kolkata has no daylight saving, so the offset is fixed). */
export const dayStart = (key) => new Date(`${key}T00:00:00+05:30`);
export const plusDays = (date, n) => new Date(new Date(date).getTime() + n * DAY);
export const dayWord = (n) => `${n} ${n === 1 ? "day" : "days"}`;
export const firstName = (member) => member?.name?.split(" ")[0] || "the member";
