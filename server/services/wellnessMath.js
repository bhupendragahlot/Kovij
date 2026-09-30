/**
 * Pure numbers for diet plans, nutrition logs and body progress. No database and no I/O, so every
 * total the app shows is computed here, in code, and unit-tested (tests/wellness.test.js).
 */
import { GYM_TZ, dayjs, gymDayKey, parseGymDay } from '../utils/time.js';

export const MACROS = ['calories', 'proteinG', 'carbsG', 'fatG'];

/** Body measurements that count as "a measurement" (height alone is a setting, not progress). */
export const BODY_FIELDS = ['weightKg', 'bodyFatPct', 'chestCm', 'waistCm', 'hipsCm', 'bicepsCm', 'thighsCm', 'neckCm', 'calvesCm'];

/** Everything tracked over time, in display order. BMI is derived, never entered. */
export const TRACKED_FIELDS = ['weightKg', 'bmi', ...BODY_FIELDS.slice(1)];

const round1 = (n) => Math.round(n * 10) / 10;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const has = (v) => typeof v === 'number' && Number.isFinite(v);

export const emptyMacros = () => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });

/** Sum anything carrying calories/proteinG/carbsG/fatG. Calories are whole numbers, grams one decimal. */
export function sumMacros(rows = []) {
  const t = emptyMacros();
  for (const row of rows) for (const k of MACROS) t[k] += num(row?.[k]);
  return { calories: Math.round(t.calories), proteinG: round1(t.proteinG), carbsG: round1(t.carbsG), fatG: round1(t.fatG) };
}

/** Energy from macros: 4 kcal per gram of protein or carbs, 9 per gram of fat. */
export function caloriesFromMacros({ proteinG, carbsG, fatG } = {}) {
  return Math.round(4 * num(proteinG) + 4 * num(carbsG) + 9 * num(fatG));
}

/**
 * One food line as stored: macros default to 0, and calories left blank are worked out from the
 * macros, so a trainer who only knows "20 g protein" still gets a sensible calorie total.
 */
export function normalizeFoodItem(item) {
  const out = {
    food: String(item.food || '').trim(),
    quantity: String(item.quantity || '').trim(),
    proteinG: round1(num(item.proteinG)),
    carbsG: round1(num(item.carbsG)),
    fatG: round1(num(item.fatG)),
  };
  out.calories = has(item.calories) ? Math.round(item.calories) : caloriesFromMacros(out);
  return out;
}

/** Per-meal and whole-day totals for a plan's meals. */
export function planTotals(meals = []) {
  const perMeal = meals.map((m) => sumMacros(m.items || []));
  return { meals: perMeal, day: sumMacros(perMeal) };
}

/**
 * A day's nutrition: planned meals (ticked or not), extra items, and totals.
 * `eaten` counts only meals that belong to this plan, so ticks left over from a replaced plan
 * never inflate the numbers.
 */
export function nutritionDay({ meals = [], eatenMealIds = [], extras = [], targets = null }) {
  const eatenSet = new Set(eatenMealIds.map(String));
  const mealRows = meals.map((m) => ({ meal: m, totals: sumMacros(m.items || []), eaten: eatenSet.has(String(m._id)) }));
  const planned = sumMacros(mealRows.map((r) => r.totals));
  const eaten = sumMacros([...mealRows.filter((r) => r.eaten).map((r) => r.totals), ...extras]);
  const remaining = targets && has(targets.calories) && targets.calories > 0 ? Math.round(targets.calories - eaten.calories) : null;
  return {
    meals: mealRows,
    planned,
    eaten,
    remainingCalories: remaining,
    mealsEaten: mealRows.filter((r) => r.eaten).length,
    mealsPlanned: mealRows.length,
  };
}

/** BMI to one decimal, or null when weight or height is missing. */
export function computeBmi(weightKg, heightCm) {
  if (!has(weightKg) || !has(heightCm) || weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

/**
 * Asia-Pacific BMI cut-offs (WHO expert consultation, 2004). They suit Indian adults better
 * than the international 25/30 bands because health risk rises at a lower BMI.
 */
export const BMI_BANDS = [
  { key: 'underweight', label: 'Underweight', min: 0, max: 18.5 },
  { key: 'healthy', label: 'Healthy weight', min: 18.5, max: 23 },
  { key: 'overweight', label: 'Overweight', min: 23, max: 25 },
  { key: 'obese', label: 'Obese', min: 25, max: Infinity },
];

export function bmiCategory(bmi) {
  if (!has(bmi) || bmi <= 0) return null;
  const band = BMI_BANDS.find((b) => bmi < b.max) || BMI_BANDS[BMI_BANDS.length - 1];
  const range = band.max === Infinity ? `${band.min} and above` : band.min === 0 ? `below ${band.max}` : `${band.min} to ${round1(band.max - 0.1)}`;
  return { key: band.key, label: band.label, range };
}

/** Change per field from `from` to `to`, only where both have a value. */
export function changeBetween(from, to, fields = TRACKED_FIELDS) {
  const out = {};
  if (!from || !to) return out;
  for (const f of fields) if (has(from[f]) && has(to[f])) out[f] = round1(to[f] - from[f]);
  return out;
}

/**
 * Each entry gains `sincePrevious` and `sinceFirst` per field. Entries are often partial (a
 * member logs weight only), so "previous" and "first" are per field: the nearest earlier entry
 * that has that value. Input and output are oldest first.
 */
export function annotateEntries(entriesOldestFirst, fields = TRACKED_FIELDS) {
  const first = {};
  const last = {};
  return entriesOldestFirst.map((e) => {
    const sincePrevious = {};
    const sinceFirst = {};
    for (const f of fields) {
      if (!has(e[f])) continue;
      if (f in last) sincePrevious[f] = round1(e[f] - last[f]);
      if (f in first) sinceFirst[f] = round1(e[f] - first[f]);
      else first[f] = e[f];
      last[f] = e[f];
    }
    return { ...e, sincePrevious, sinceFirst };
  });
}

/** Earliest and latest value of every field, with the date each was taken. */
function valuesAcross(entriesOldestFirst, fields) {
  const first = {};
  const latest = {};
  for (const e of entriesOldestFirst) {
    for (const f of fields) {
      if (!has(e[f])) continue;
      if (!(f in first)) first[f] = { value: e[f], day: e.day };
      latest[f] = { value: e[f], day: e.day };
    }
  }
  return { first, latest };
}

/** Headline progress: first vs latest value of each field, plus BMI band. */
export function progressSummary(entriesOldestFirst, { heightCm = null } = {}) {
  const fields = TRACKED_FIELDS;
  const { first, latest } = valuesAcross(entriesOldestFirst, fields);
  const change = {};
  for (const f of fields) if (first[f] && latest[f] && first[f].day !== latest[f].day) change[f] = round1(latest[f].value - first[f].value);
  const bmi = latest.bmi?.value ?? null;
  return {
    entries: entriesOldestFirst.length,
    firstDay: entriesOldestFirst[0]?.day || null,
    latestDay: entriesOldestFirst[entriesOldestFirst.length - 1]?.day || null,
    heightCm,
    first: Object.fromEntries(Object.entries(first).map(([k, v]) => [k, v.value])),
    latest: Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v.value])),
    latestDays: Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v.day])),
    change,
    bmi,
    bmiCategory: bmiCategory(bmi),
  };
}

// ── Gym-calendar days ───────────────────────────────────────────────────────

/** `YYYY-MM-DD` that is a real calendar date (rejects 2026-02-30). */
export function isRealDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = parseGymDay(day);
  return d.isValid() && d.format('YYYY-MM-DD') === day;
}

/** Whole gym days from today to `day`: 0 today, -1 yesterday, 1 tomorrow. */
export function dayOffset(day, now = new Date()) {
  const today = parseGymDay(gymDayKey(now));
  return Math.round(parseGymDay(day).diff(today, 'day', true));
}

/** Start and end instants of a gym day. */
export function dayBounds(day) {
  const start = dayjs.tz(day, 'YYYY-MM-DD', GYM_TZ);
  return { start: start.toDate(), end: start.endOf('day').toDate() };
}

/** Gym day keys from `from` to `to` inclusive, newest first. */
export function daysBetween(fromDay, toDay) {
  const out = [];
  let d = parseGymDay(toDay);
  const stop = parseGymDay(fromDay);
  while (!d.isBefore(stop, 'day') && out.length < 400) {
    out.push(d.format('YYYY-MM-DD'));
    d = d.subtract(1, 'day');
  }
  return out;
}

/** The day `n` days before (negative) or after `day`. */
export const shiftDay = (day, n) => parseGymDay(day).add(n, 'day').format('YYYY-MM-DD');

/**
 * Which plan assignment applies on a given day: it started on or before the day and had not
 * ended by the end of it. When several qualify (a plan replaced mid-way), the latest start wins.
 * `assignments` carry startDate and optional endedAt.
 */
export function planInEffect(assignments, day) {
  const { end } = dayBounds(day);
  let best = null;
  for (const a of assignments) {
    const start = new Date(a.startDate);
    if (start > end) continue;
    if (a.endedAt && new Date(a.endedAt) <= end) continue;
    if (!best || start > new Date(best.startDate) || (start.getTime() === new Date(best.startDate).getTime() && String(a._id) > String(best._id))) best = a;
  }
  return best;
}
