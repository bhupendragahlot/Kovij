import { formatNumber } from "../../shared/lib/format";

/** Everything tracked over time, in display order. BMI is worked out by the server. */
export const METRICS = [
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "bmi", label: "BMI", unit: "" },
  { key: "bodyFatPct", label: "Body fat", unit: "%" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "hipsCm", label: "Hips", unit: "cm" },
  { key: "bicepsCm", label: "Biceps", unit: "cm" },
  { key: "thighsCm", label: "Thighs", unit: "cm" },
  { key: "neckCm", label: "Neck", unit: "cm" },
  { key: "calvesCm", label: "Calves", unit: "cm" },
];
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.key, m]));

/** Tape measurements entered in the form, with the server's limits for the inputs. */
export const TAPE_FIELDS = [
  { key: "chestCm", label: "Chest", min: 30, max: 250 },
  { key: "waistCm", label: "Waist", min: 30, max: 250 },
  { key: "hipsCm", label: "Hips", min: 30, max: 250 },
  { key: "bicepsCm", label: "Biceps", min: 10, max: 80 },
  { key: "thighsCm", label: "Thighs", min: 20, max: 120 },
  { key: "neckCm", label: "Neck", min: 20, max: 70 },
  { key: "calvesCm", label: "Calves", min: 15, max: 80 },
];

export const BMI_TONE = { underweight: "warn", healthy: "good", overweight: "warn", obese: "bad" };

export const POSES = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
];
export const POSE_LABEL = Object.fromEntries(POSES.map((p) => [p.value, p.label]));

/**
 * Which direction counts as progress for a metric, given the member's goal: "down", "up", or
 * null when either could be right (then changes are shown without good/bad colour).
 */
export function goodDirection(metric, goalKind) {
  if (metric === "weightKg" || metric === "bmi") {
    if (goalKind === "weight_loss") return "down";
    if (goalKind === "weight_gain" || goalKind === "muscle_building") return "up";
    return null;
  }
  if (metric === "bodyFatPct" || metric === "waistCm") return "down";
  return null;
}

export const formatMeasure = (value, unit) => (value == null ? "" : `${formatNumber(value)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`);

/** "−1.6 kg", "+0.5 cm", "no change" */
export function formatChange(delta, unit) {
  if (delta == null) return "";
  if (delta === 0) return "no change";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${formatMeasure(Math.abs(delta), unit)}`;
}

/** Day key → a Date at noon in gym time, for the shared date formatters. */
export const dayToDate = (day) => new Date(`${day}T12:00:00+05:30`);
