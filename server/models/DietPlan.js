import mongoose from 'mongoose';

export const DIET_TYPES = ['veg', 'non_veg', 'eggetarian', 'vegan'];
export const DIET_GOALS = ['weight_loss', 'weight_gain', 'muscle_building', 'general_fitness', 'other'];

/** One food line. Free text so dal, roti and poha are as easy to enter as oats. */
export const foodItemSchema = new mongoose.Schema({
  food: { type: String, required: true, trim: true, maxlength: 80 },
  /** Household measure, e.g. "2 rotis", "1 katori", "200 ml". */
  quantity: { type: String, trim: true, default: '', maxlength: 60 },
  calories: { type: Number, min: 0, default: 0 },
  proteinG: { type: Number, min: 0, default: 0 },
  carbsG: { type: Number, min: 0, default: 0 },
  fatG: { type: Number, min: 0, default: 0 },
});

export const mealSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  /** "07:30" in gym time, or '' when the meal has no fixed time. */
  time: { type: String, default: '' },
  items: { type: [foodItemSchema], default: [] },
});

export const targetsSchema = new mongoose.Schema(
  {
    calories: { type: Number, min: 0 },
    proteinG: { type: Number, min: 0 },
    carbsG: { type: Number, min: 0 },
    fatG: { type: Number, min: 0 },
  },
  { _id: false }
);

/**
 * A reusable diet template written by a trainer. Members never point at it directly: assigning
 * copies it (DietAssignment.plan), so editing a template never changes a plan a member follows.
 * Totals are computed in code on read (services/wellnessMath.js), never stored.
 */
const dietPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    goal: { type: String, enum: DIET_GOALS, default: 'general_fitness' },
    dietType: { type: String, enum: DIET_TYPES, default: 'veg' },
    targets: { type: targetsSchema, default: () => ({}) },
    meals: { type: [mealSchema], default: [] },
    notes: { type: String, default: '', maxlength: 2000 },
    /** Archived plans stay on members' profiles but can't be assigned again. */
    archived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

dietPlanSchema.index({ archived: 1, updatedAt: -1 });

export default mongoose.model('DietPlan', dietPlanSchema);
