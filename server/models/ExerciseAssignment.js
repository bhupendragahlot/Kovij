import mongoose from 'mongoose';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLES } from '../services/training/constants.js';

/**
 * One ExerciseDB exercise a trainer scheduled for one member on one gym day, with what to do
 * (sets, reps, time, rest, weight) and whether the member did it.
 *
 * The exercise is kept as ExerciseDB's stable id plus a short snapshot (name, muscles,
 * equipment) so history reads the same even if ExerciseDB changes; instructions and media are
 * fetched live (ExerciseDB rotates media links weekly). Records are never deleted: a removed
 * one is "cancelled" and a done one stays as history.
 */
const exerciseSnapshotSchema = new mongoose.Schema(
  {
    exerciseDbId: { type: String, required: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    bodyParts: { type: [String], default: [] },
    targetMuscles: { type: [String], default: [] },
    equipments: { type: [String], default: [] },
    /** The same exercise in the gym's own words (for reports beside workout plans). */
    primaryMuscle: { type: String, enum: MUSCLES },
    equipment: { type: String, enum: EQUIPMENT },
    category: { type: String, enum: EXERCISE_CATEGORIES },
  },
  { _id: false }
);

const exerciseAssignmentSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    /** The member's trainer when it was assigned, for trainer views and reports. */
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    exercise: { type: exerciseSnapshotSchema, required: true },
    /** Gym-local day it is scheduled for (YYYY-MM-DD) and the start of that day. */
    dayKey: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    /** Position within that day's list. */
    order: { type: Number, default: 0 },
    sets: { type: Number, min: 1, max: 20 },
    /** Free text like workout plans: "8-12", "AMRAP", "10 each side". */
    reps: { type: String, trim: true, maxlength: 20, default: '' },
    durationSec: { type: Number, min: 0, max: 7200 },
    restSec: { type: Number, min: 0, max: 900 },
    weightKg: { type: Number, min: 0, max: 1000 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },

    status: { type: String, enum: ['assigned', 'completed', 'cancelled'], default: 'assigned' },
    completedAt: { type: Date },
    completedBy: { type: String, enum: ['member', 'staff'] },
    completedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** How it went, in the member's words. */
    memberNote: { type: String, trim: true, maxlength: 500, default: '' },
    cancelledAt: { type: Date },
    cancelledByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** `<Idempotency-Key>:<n>`: a retried assign never creates a second copy. */
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

exerciseAssignmentSchema.index({ memberId: 1, dayKey: 1, order: 1 });
exerciseAssignmentSchema.index({ memberId: 1, status: 1, completedAt: -1 });
exerciseAssignmentSchema.index({ trainerId: 1, dayKey: -1 });
exerciseAssignmentSchema.index({ dayKey: 1, status: 1 });
exerciseAssignmentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export default mongoose.model('ExerciseAssignment', exerciseAssignmentSchema);
