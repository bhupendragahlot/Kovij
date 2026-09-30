import mongoose from 'mongoose';
import { foodItemSchema } from './DietPlan.js';

/**
 * What one member ate on one gym day: planned meals ticked off, extra items, and water.
 * Totals are not stored: they are computed from the plan in effect that day plus the extras
 * (services/wellnessMath.js), so a tick and an extra item can never disagree with the total.
 * Every write is a single atomic update, safe when the member and a trainer log at once.
 */
const extraItemSchema = foodItemSchema.clone();
extraItemSchema.add({
  addedByKind: { type: String, enum: ['member', 'staff'], default: 'member' },
  addedBy: { type: mongoose.Schema.Types.ObjectId },
  addedAt: { type: Date, default: Date.now },
});

const nutritionLogSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    /** Gym calendar day, YYYY-MM-DD. */
    day: { type: String, required: true },
    /** Start of that gym day, for date-range queries. */
    date: { type: Date, required: true },
    /** Meal ids (from the assignment's copy of the plan) marked as eaten. */
    eatenMealIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    extras: { type: [extraItemSchema], default: [] },
    waterGlasses: { type: Number, min: 0, max: 30, default: 0 },
  },
  { timestamps: true }
);

nutritionLogSchema.index({ memberId: 1, day: 1 }, { unique: true });
nutritionLogSchema.index({ memberId: 1, date: -1 });

export default mongoose.model('NutritionLog', nutritionLogSchema);
