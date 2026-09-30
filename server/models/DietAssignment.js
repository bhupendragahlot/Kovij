import mongoose from 'mongoose';
import { DIET_GOALS, DIET_TYPES, mealSchema, targetsSchema } from './DietPlan.js';

/**
 * A diet plan given to one member: a frozen copy of the template at the time it was assigned,
 * so later template edits never change what the member is following or what they logged.
 *
 * A plan applies from `startDate` until `endedAt` (exclusive of the day it ends on). Assigning a
 * new plan ends the previous one where the new one starts. At most one assignment per member is
 * `active` (the current or upcoming plan); older ones are `ended` and kept as history.
 */
const dietAssignmentSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    /** Template it was copied from (may since have been edited or deleted). */
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'DietPlan' },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    /** Start of the first gym day the plan applies. */
    startDate: { type: Date, required: true },
    startDay: { type: String, required: true },
    endedAt: { type: Date },
    plan: {
      name: { type: String, required: true, trim: true },
      goal: { type: String, enum: DIET_GOALS },
      dietType: { type: String, enum: DIET_TYPES },
      targets: { type: targetsSchema, default: () => ({}) },
      meals: { type: [mealSchema], default: [] },
      notes: { type: String, default: '' },
    },
    /** Message from the trainer to the member, e.g. "Drink 3 litres of water". */
    note: { type: String, default: '', maxlength: 500 },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedByName: { type: String, default: '' },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Backstop for the Idempotency-Key of the request that created it. */
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

dietAssignmentSchema.index({ memberId: 1 }, { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_diet_per_member' });
dietAssignmentSchema.index({ memberId: 1, startDate: -1 });
dietAssignmentSchema.index({ planId: 1, status: 1 });
dietAssignmentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export default mongoose.model('DietAssignment', dietAssignmentSchema);
