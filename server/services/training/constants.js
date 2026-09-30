/**
 * Shared vocabulary for trainers, the exercise library and workout plans. The staff UI keeps
 * matching labels in kovij-fitness-zone/src/features/workouts/labels.js.
 */
export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
];

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'cardio_machine', 'other'];

export const EXERCISE_CATEGORIES = ['strength', 'cardio', 'mobility', 'stretching'];

export const PLAN_GOALS = ['muscle_gain', 'fat_loss', 'strength', 'general_fitness', 'endurance'];

export const PLAN_LEVELS = ['beginner', 'intermediate', 'advanced'];

/** Limits shared by validators and services. */
export const LIMITS = {
  daysPerPlan: 7,
  exercisesPerDay: 30,
  setsPerExercise: 20,
  shiftsPerDay: 3,
  membersPerAssign: 50,
  /** How far back a session can be logged. Members get a shorter window than staff. */
  memberLogDaysBack: 7,
  staffLogDaysBack: 60,
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
