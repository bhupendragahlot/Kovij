/**
 * Words and numbers for ExerciseDB exercises and the exercises trainers schedule from it.
 * Shared by the staff app and the member app.
 */

/** ExerciseDB words are lower case ("upper legs"): "Upper legs". */
export const cap = (s) => {
  const t = String(s || "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

/** "90" → "1 min 30 sec", "45" → "45 sec", "600" → "10 min". */
export function formatSeconds(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} min ${s % 60} sec` : `${m} min`;
}

/** "4 × 8-10 · 40 kg · rest 1 min 30 sec", or "10 min · rest 1 min" for timed exercises. */
export function prescription(a, { rest = true } = {}) {
  const parts = [];
  if (a.sets) parts.push(a.reps ? `${a.sets} × ${a.reps}` : `${a.sets} ${a.sets === 1 ? "set" : "sets"}`);
  if (a.durationSec) parts.push(formatSeconds(a.durationSec));
  if (a.weightKg) parts.push(`${Math.round(a.weightKg * 100) / 100} kg`);
  if (rest && a.restSec) parts.push(`rest ${formatSeconds(a.restSec)}`);
  return parts.join(" · ");
}

/** The muscles and equipment line under a name: "Chest · Pectorals · Barbell". */
export const exerciseFacts = (e) => [e.bodyParts?.[0], e.targetMuscles?.[0], e.equipments?.[0]].filter(Boolean).map(cap).join(" · ");

/** A gym day ("2026-10-08") as a Date at gym noon, safe to format in any timezone. */
export const dayDate = (dayKey) => new Date(`${dayKey}T12:00:00+05:30`);

const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const longDayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

/** "Today", "Tomorrow", "Yesterday" or "Thu, 9 Oct". */
export function dayLabel(dayKey, todayKey, { long = false } = {}) {
  const diff = Math.round((Date.parse(`${dayKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return (long ? longDayFmt : dayFmt).format(dayDate(dayKey));
}

/** [{ dayKey, items }] in day order. */
export function groupByDay(items = []) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.dayKey)) groups.set(item.dayKey, []);
    groups.get(item.dayKey).push(item);
  }
  return [...groups.entries()].map(([dayKey, list]) => ({ dayKey, items: list }));
}

/** How each state reads, with a badge tone. */
export const STATE = {
  done: { label: "Done", tone: "good" },
  today: { label: "To do", tone: "brand" },
  upcoming: { label: "Coming up", tone: "neutral" },
  missed: { label: "Missed", tone: "warn" },
  cancelled: { label: "Removed", tone: "neutral" },
};

/** Busy/unavailable answers from our server when ExerciseDB can't be reached. */
export const isExerciseDbOutage = (err) => ["EXERCISEDB_BUSY", "EXERCISEDB_UNAVAILABLE", "EXERCISEDB_AUTH"].includes(err?.code);

/** Don't hammer a busy ExerciseDB: retry other failures once. */
export const exerciseDbRetry = (count, err) => count < 1 && err?.code !== "EXERCISEDB_BUSY" && !(err?.status >= 400 && err?.status < 500);
