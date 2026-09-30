import mongoose from 'mongoose';

const cm = { type: Number, min: 0 };

/**
 * One progress check-in for a member on a gym day: weight, body fat and tape measurements.
 * BMI is computed in code from weight and height (services/wellnessMath.js) and stored so
 * history and charts don't need the height of the day. One entry per member per day: a second
 * reading on the same day edits that entry.
 */
const bodyMeasurementSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    /** Start of the gym day the entry is for. */
    takenAt: { type: Date, required: true, default: Date.now, index: true },
    /** Gym calendar day, YYYY-MM-DD. Absent on entries made before 2026-10. */
    day: { type: String },
    weightKg: { type: Number, min: 0 },
    heightCm: { type: Number, min: 0 },
    bmi: { type: Number, min: 0 },
    bodyFatPct: { type: Number, min: 0, max: 100 },
    chestCm: cm,
    waistCm: cm,
    hipsCm: cm,
    bicepsCm: cm,
    thighsCm: cm,
    neckCm: cm,
    calvesCm: cm,
    /** Legacy field, unused: progress photos are ProgressPhoto documents. */
    photos: [{ type: String }],
    notes: { type: String, default: '', maxlength: 500 },
    recordedByKind: { type: String, enum: ['member', 'staff'] },
    recordedBy: { type: mongoose.Schema.Types.ObjectId },
    recordedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

bodyMeasurementSchema.index({ memberId: 1, takenAt: -1 });
bodyMeasurementSchema.index({ memberId: 1, day: 1 }, { unique: true, partialFilterExpression: { day: { $type: 'string' } } });

export default mongoose.model('BodyMeasurement', bodyMeasurementSchema);
