import mongoose from 'mongoose';

const trainerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Public title, e.g. "Strength coach". */
    role: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    instagram: { type: String, default: '' },
    description: { type: String, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    specialties: [{ type: String, trim: true }],
    /** Shift or availability note shown to desk staff, e.g. "6–11 am, Mon–Sat". */
    shift: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    showOnFrontend: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Trainer', trainerSchema);
