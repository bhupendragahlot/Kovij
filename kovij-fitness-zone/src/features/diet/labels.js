import { Drumstick, Egg, Leaf, Sprout } from "lucide-react";
import { formatNumber } from "../../shared/lib/format";

/** Diet vocabulary shared by the plan pages and the member tab. Icon + word, never colour alone. */
export const DIET_TYPE = {
  veg: { label: "Veg", icon: Leaf, tone: "good" },
  eggetarian: { label: "Eggetarian", icon: Egg, tone: "warn" },
  non_veg: { label: "Non-veg", icon: Drumstick, tone: "bad" },
  vegan: { label: "Vegan", icon: Sprout, tone: "good" },
};

export const DIET_GOAL = {
  weight_loss: "Weight loss",
  weight_gain: "Weight gain",
  muscle_building: "Muscle building",
  general_fitness: "General fitness",
  other: "Other",
};

/** Suggested meal names and times for a typical Indian day. */
export const MEAL_PRESETS = [
  { name: "Early morning", time: "06:00" },
  { name: "Breakfast", time: "08:00" },
  { name: "Mid-morning", time: "11:00" },
  { name: "Lunch", time: "13:30" },
  { name: "Evening snack", time: "17:00" },
  { name: "Post-workout", time: "19:00" },
  { name: "Dinner", time: "20:30" },
  { name: "Bedtime", time: "22:00" },
];

const round1 = (n) => Math.round(n * 10) / 10;
const toNum = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/** Calories for an item being edited: typed value, else worked out from macros (4/4/9), like the server. */
export function itemCalories(item) {
  const typed = toNum(item.calories);
  if (typed != null) return Math.round(typed);
  return Math.round(4 * (toNum(item.proteinG) || 0) + 4 * (toNum(item.carbsG) || 0) + 9 * (toNum(item.fatG) || 0));
}

/**
 * Live totals while a plan is being edited (display only; the server computes the saved totals
 * with the same rules).
 */
export function draftTotals(items) {
  const t = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const it of items) {
    t.calories += itemCalories(it);
    t.proteinG += toNum(it.proteinG) || 0;
    t.carbsG += toNum(it.carbsG) || 0;
    t.fatG += toNum(it.fatG) || 0;
  }
  return { calories: Math.round(t.calories), proteinG: round1(t.proteinG), carbsG: round1(t.carbsG), fatG: round1(t.fatG) };
}

export const formatKcal = (n) => `${formatNumber(Math.round(Number(n) || 0))} kcal`;
export const formatGrams = (n) => `${formatNumber(round1(Number(n) || 0))} g`;

/** "07:30" → "7:30 am" */
export function formatMealTime(hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "Poha (1 plate), Milk (200 ml)" */
export const itemsLine = (items = []) => items.map((i) => (i.quantity ? `${i.food} (${i.quantity})` : i.food)).join(", ");

/** YYYY-MM-DD shifted by whole days (calendar arithmetic on the day key, no time zones). */
export function shiftDayKey(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
