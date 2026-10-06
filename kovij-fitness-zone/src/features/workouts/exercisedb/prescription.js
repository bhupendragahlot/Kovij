/**
 * What to do for one scheduled exercise: sets × reps, or a time (with optional sets), plus rest,
 * weight and a note. Form values are strings; toPrescription() turns them into the API payload.
 */
export function prescriptionForm(exercise, current) {
  if (current) {
    const timed = Boolean(current.durationSec);
    return {
      mode: timed ? "time" : "reps",
      sets: current.sets ? String(current.sets) : "",
      reps: current.reps || "",
      min: timed ? String(Math.floor(current.durationSec / 60) || "") : "",
      sec: timed ? String(current.durationSec % 60 || "") : "",
      restSec: String(current.restSec ?? 60),
      weightKg: current.weightKg != null ? String(current.weightKg) : "",
      notes: current.notes || "",
    };
  }
  const cardio = exercise?.category === "cardio";
  return {
    mode: cardio ? "time" : "reps",
    sets: cardio ? "" : "3",
    reps: cardio ? "" : "10",
    min: cardio ? "10" : "",
    sec: "",
    restSec: cardio ? "0" : "60",
    weightKg: "",
    notes: "",
  };
}

const num = (v) => (v === "" || v == null ? null : Number(v));

export function toPrescription(f) {
  const durationSec = f.mode === "time" ? (Number(f.min) || 0) * 60 + (Number(f.sec) || 0) || null : null;
  return {
    sets: num(f.sets),
    reps: f.mode === "reps" ? f.reps.trim() : "",
    durationSec,
    restSec: Number(f.restSec) || 0,
    weightKg: num(f.weightKg),
    notes: f.notes.trim(),
  };
}
