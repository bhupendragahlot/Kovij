import mongoose from 'mongoose';

const bodyMeasurementSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    takenAt: { type: Date, required: true, default: Date.now, index: true },
    weightKg: { type: Number },
    bodyFatPct: { type: Number },
    chestCm: { type: Number },
    waistCm: { type: Number },
    hipsCm: { type: Number },
    bicepsCm: { type: Number },
    thighsCm: { type: Number },
    photos: [{ type: String }],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

bodyMeasurementSchema.index({ memberId: 1, takenAt: -1 });

export default mongoose.model('BodyMeasurement', bodyMeasurementSchema);
