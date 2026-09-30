/**
 * Words for the training module's values. Mirrors server/services/training/constants.js.
 */
export const MUSCLE_LABEL = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  full_body: "Full body",
};

export const EQUIPMENT_LABEL = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  band: "Band",
  cardio_machine: "Cardio machine",
  other: "Other",
};

export const CATEGORY_LABEL = { strength: "Strength", cardio: "Cardio", mobility: "Mobility", stretching: "Stretching" };

export const PLAN_GOAL_LABEL = {
  muscle_gain: "Build muscle",
  fat_loss: "Lose fat",
  strength: "Get stronger",
  general_fitness: "General fitness",
  endurance: "Stamina",
};

export const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Rest choices trainers actually use, in seconds. */
export const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 180, 240, 300];

export function formatRest(sec) {
  const s = Number(sec) || 0;
  if (!s) return "No rest";
  if (s < 60) return `${s} sec`;
  return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} sec` : `${s / 60} min`;
}

/** "3 × 8-12 @ 40 kg" */
export function formatPrescription(e) {
  const load = e.weightKg ? ` @ ${formatKg(e.weightKg)}` : "";
  return `${e.sets} × ${e.reps}${load}`;
}

export const formatKg = (kg) => `${Math.round((Number(kg) || 0) * 100) / 100} kg`;

/** A gym calendar day ("2026-09-30") as a Date at gym noon, safe to format in any timezone. */
export const dayKeyDate = (dayKey) => (dayKey ? new Date(`${dayKey}T12:00:00+05:30`) : null);

/** The first number in a reps prescription ("8-12" → 8, "45 sec" → 45), for prefilling a log. */
export function firstNumber(text) {
  const m = /\d+/.exec(String(text || ""));
  return m ? Number(m[0]) : "";
}

/** Days per week as words: "3 days a week". */
export const perWeek = (n) => `${n} ${Number(n) === 1 ? "day" : "days"} a week`;
