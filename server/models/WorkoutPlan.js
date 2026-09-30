import mongoose from 'mongoose';
import { PLAN_GOALS, PLAN_LEVELS } from '../services/training/constants.js';

/**
 * A reusable workout plan template ("Beginner full body, 3 days"). Members get a snapshot of it
 * (WorkoutAssignment), so editing a template never changes what someone is already doing.
 */
const planExerciseSchema = new mongoose.Schema({
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  sets: { type: Number, min: 1, max: 20, default: 3 },
  /** Free text so trainers can write "8-12", "AMRAP" or "30 sec". */
  reps: { type: String, trim: true, maxlength: 20, default: '10' },
  weightKg: { type: Number, min: 0, max: 1000 },
  restSec: { type: Number, min: 0, max: 900, default: 60 },
  notes: { type: String, trim: true, maxlength: 300, default: '' },
  order: { type: Number, default: 0 },
});

const planDaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  exercises: { type: [planExerciseSchema], default: [] },
});

const workoutPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    goal: { type: String, enum: PLAN_GOALS, default: 'general_fitness' },
    level: { type: String, enum: PLAN_LEVELS, default: 'beginner' },
    /** How many sessions a week; the days below rotate in order. */
    daysPerWeek: { type: Number, min: 1, max: 7, default: 3 },
    days: { type: [planDaySchema], default: [] },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

workoutPlanSchema.index({ archived: 1, updatedAt: -1 });
workoutPlanSchema.index({ 'days.exercises.exerciseId': 1 });

export default mongoose.model('WorkoutPlan', workoutPlanSchema);
