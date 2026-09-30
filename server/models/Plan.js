import mongoose from 'mongoose';

export const PLAN_DURATIONS = ['day', 'week', 'month', 'quarter', 'half_year', 'year'];

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Rupees. Older documents stored this as a string; the startup migration converts them. */
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, required: true, enum: PLAN_DURATIONS },
    /** Optional override; if set, used instead of mapping from `duration` */
    durationInDays: { type: Number, min: 1 },
    description: { type: String, default: '', trim: true },
    features: [{ type: String, trim: true }],
    popular: { type: Boolean, default: false },
    color: { type: String, default: 'from-gray-600 to-gray-700' },
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    showOnFrontend: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Plan', planSchema);
