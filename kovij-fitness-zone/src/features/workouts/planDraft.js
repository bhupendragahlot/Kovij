/**
 * Editable plan days, shared by the plan builder and "edit this member's plan".
 * Draft rows carry a local `key` for React and keep numbers as typed until saving.
 */
let seq = 0;
const nextKey = () => `k${Date.now().toString(36)}${(seq += 1)}`;

/** Sensible starting prescription for a newly added exercise. */
function defaultsFor(exercise) {
  if (exercise.category === "cardio") return { sets: 1, reps: "10 min", restSec: 0 };
  if (exercise.category === "mobility" || exercise.category === "stretching") return { sets: 2, reps: "30 sec", restSec: 0 };
  return { sets: 3, reps: "10", restSec: 60 };
}

export function draftExercise(exercise) {
  return {
    key: nextKey(),
    exerciseId: exercise._id,
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    equipment: exercise.equipment,
    archived: Boolean(exercise.archived),
    weightKg: "",
    notes: "",
    ...defaultsFor(exercise),
  };
}

export const emptyDay = (index) => ({ key: nextKey(), name: `Day ${index + 1}`, exercises: [] });

/** Server days (template with `exercise` details, or a member snapshot) → draft. */
export function toDraftDays(days = []) {
  return days.map((d) => ({
    key: nextKey(),
    name: d.name,
    exercises: d.exercises.map((e) => ({
      key: nextKey(),
      exerciseId: e.exerciseId,
      name: e.exercise?.name ?? e.name,
      primaryMuscle: e.exercise?.primaryMuscle ?? e.primaryMuscle,
      equipment: e.exercise?.equipment ?? e.equipment,
      archived: Boolean(e.exercise?.archived),
      sets: e.sets,
      reps: e.reps,
      weightKg: e.weightKg ?? "",
      restSec: e.restSec ?? 60,
      notes: e.notes || "",
    })),
  }));
}

/** Draft → request body. */
export function toPayloadDays(days) {
  return days.map((d) => ({
    name: d.name.trim(),
    exercises: d.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      sets: Number(e.sets),
      reps: String(e.reps).trim(),
      weightKg: e.weightKg === "" || e.weightKg == null ? undefined : Number(e.weightKg),
      restSec: Number(e.restSec) || 0,
      notes: e.notes?.trim() || undefined,
    })),
  }));
}

export function duplicateDay(day) {
  return { ...day, key: nextKey(), name: `${day.name} (copy)`.slice(0, 60), exercises: day.exercises.map((e) => ({ ...e, key: nextKey() })) };
}

/** Move an item one place up (-1) or down (+1). */
export function move(list, index, step) {
  const to = index + step;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Problems to fix before saving, keyed like the server's field paths. */
export function draftProblems(days) {
  const out = {};
  if (!days.length) out.days = "Add at least one day";
  days.forEach((d, i) => {
    if (!d.name.trim()) out[`days.${i}.name`] = "Name this day";
    d.exercises.forEach((e, j) => {
      const sets = Number(e.sets);
      if (!Number.isInteger(sets) || sets < 1 || sets > 20) out[`days.${i}.exercises.${j}.sets`] = "1 to 20";
      if (!String(e.reps).trim()) out[`days.${i}.exercises.${j}.reps`] = "Add reps";
      if (e.weightKg !== "" && e.weightKg != null && (Number.isNaN(Number(e.weightKg)) || Number(e.weightKg) < 0 || Number(e.weightKg) > 1000)) {
        out[`days.${i}.exercises.${j}.weightKg`] = "Check the weight";
      }
    });
  });
  return out;
}

export const countExercises = (days) => days.reduce((n, d) => n + d.exercises.length, 0);
