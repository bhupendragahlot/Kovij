import mongoose from 'mongoose';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLES } from '../services/training/constants.js';

/**
 * One movement in the gym's exercise library. Built-in exercises carry a `seedKey`; the gym's
 * own have none. Exercises used by a plan or a logged session are archived, never deleted,
 * so history keeps its names.
 */
const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Normalised name (see exerciseNameKey) so "Push-up" and "push up" can't both exist. */
    nameKey: { type: String, required: true },
    primaryMuscle: { type: String, enum: MUSCLES, required: true },
    secondaryMuscles: [{ type: String, enum: MUSCLES }],
    equipment: { type: String, enum: EQUIPMENT, required: true },
    category: { type: String, enum: EXERCISE_CATEGORIES, default: 'strength' },
    instructions: { type: String, default: '', maxlength: 2000 },
    videoUrl: { type: String, default: '' },
    seedKey: { type: String },
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

exerciseSchema.index({ nameKey: 1 }, { unique: true });
exerciseSchema.index({ seedKey: 1 }, { unique: true, partialFilterExpression: { seedKey: { $type: 'string' } } });
exerciseSchema.index({ archived: 1, primaryMuscle: 1, name: 1 });

export default mongoose.model('Exercise', exerciseSchema);
