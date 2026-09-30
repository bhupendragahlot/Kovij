import mongoose from 'mongoose';

/**
 * One training session: which plan day, and the sets actually done. Unique per member, gym day
 * and plan day, so saving the same session again (a retry, or an edit) updates it in place.
 */
const logSetSchema = new mongoose.Schema(
  {
    reps: { type: Number, min: 0, max: 500, default: 0 },
    weightKg: { type: Number, min: 0, max: 1000, default: 0 },
    done: { type: Boolean, default: true },
  },
  { _id: false }
);

const logEntrySchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    name: { type: String, required: true },
    sets: { type: [logSetSchema], default: [] },
  },
  { _id: false }
);

const workoutLogSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    /** The plan the member was on that day (absent for sessions logged without a plan). */
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkoutAssignment' },
    /** Gym-local calendar day, YYYY-MM-DD. */
    dayKey: { type: String, required: true },
    /** Start of that gym day, for sorting and date ranges. */
    performedAt: { type: Date, required: true },
    dayIndex: { type: Number, min: 0, max: 6, default: 0 },
    dayName: { type: String, default: '' },
    entries: { type: [logEntrySchema], default: [] },
    notes: { type: String, default: '', maxlength: 1000 },
    volumeKg: { type: Number, default: 0 },
    setsDone: { type: Number, default: 0 },
    loggedBy: { type: String, enum: ['member', 'staff'], required: true },
    loggedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

workoutLogSchema.index({ memberId: 1, dayKey: 1, dayIndex: 1 }, { unique: true });
workoutLogSchema.index({ memberId: 1, performedAt: -1 });
workoutLogSchema.index({ assignmentId: 1, performedAt: -1 });
workoutLogSchema.index({ memberId: 1, 'entries.exerciseId': 1 });

export default mongoose.model('WorkoutLog', workoutLogSchema);
