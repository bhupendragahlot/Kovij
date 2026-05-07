import mongoose from 'mongoose';

const memberProfileSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      unique: true,
      index: true,
    },
    heightCm: { type: Number, min: 0 },
    weightKg: { type: Number, min: 0 },
    bmi: { type: Number, min: 0 },
    bloodGroup: { type: String, trim: true },
    medicalCondition: {
      has: { type: Boolean, default: false },
      details: { type: String, default: '' },
    },
    injuries: { type: String, default: '' },
    allergies: { type: String, default: '' },
    fitnessGoal: {
      goalKind: {
        type: String,
        enum: ['weight_loss', 'weight_gain', 'muscle_building', 'general_fitness', 'other'],
      },
      customText: { type: String, default: '' },
    },
    idProof: {
      type: { type: String, enum: ['aadhar', 'pan', 'passport', 'driving_license', 'other'], default: 'other' },
      url: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('MemberProfile', memberProfileSchema);
