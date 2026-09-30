import mongoose from 'mongoose';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLES, PLAN_GOALS, PLAN_LEVELS } from '../services/training/constants.js';

/**
 * The workout plan a member is following: a snapshot of a template (names, sets, reps and
 * instructions copied in), optionally adjusted for this member. One active assignment per
 * member; earlier ones stay as history with status "ended".
 */
const snapshotExerciseSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  name: { type: String, required: true },
  primaryMuscle: { type: String, enum: MUSCLES },
  equipment: { type: String, enum: EQUIPMENT },
  category: { type: String, enum: EXERCISE_CATEGORIES },
  instructions: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  sets: { type: Number, min: 1, max: 20, default: 3 },
  reps: { type: String, trim: true, maxlength: 20, default: '10' },
  weightKg: { type: Number, min: 0, max: 1000 },
  restSec: { type: Number, min: 0, max: 900, default: 60 },
  notes: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

const snapshotDaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  exercises: { type: [snapshotExerciseSchema], default: [] },
});

const workoutAssignmentSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    /** Template it came from (kept even if the template is later archived). */
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutPlan' },
    /** The member's trainer when the plan was given, for trainer reports. */
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    goal: { type: String, enum: PLAN_GOALS },
    level: { type: String, enum: PLAN_LEVELS },
    daysPerWeek: { type: Number, min: 1, max: 7, default: 3 },
    notes: { type: String, default: '', maxlength: 2000 },
    days: { type: [snapshotDaySchema], default: [] },
    /** First gym day of the plan (YYYY-MM-DD) and the same instant as a Date. */
    startDay: { type: String, required: true },
    startsAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    endedAt: { type: Date },
    endDay: { type: String },
    endReason: { type: String, enum: ['replaced', 'ended'] },
    endNote: { type: String, default: '' },
    /** Bumped on every change to this member's copy; used to de-duplicate "plan updated" messages. */
    version: { type: Number, default: 1 },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** `<Idempotency-Key>:<memberId>`: a retried assign never creates a second copy. */
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

// One current plan per member. A concurrent second assign fails here instead of leaving two.
workoutAssignmentSchema.index({ memberId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
workoutAssignmentSchema.index({ memberId: 1, startsAt: -1 });
workoutAssignmentSchema.index({ planId: 1, status: 1 });
workoutAssignmentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export default mongoose.model('WorkoutAssignment', workoutAssignmentSchema);
