import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    /** "06:00" in gym time. */
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

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
    /** Free-text availability from before weekly schedules; shown when `schedule` is empty. */
    shift: { type: String, trim: true, default: '' },
    /** Weekly floor hours: one entry per working weekday (0 = Sunday), each with 1–3 shifts. */
    schedule: {
      type: [{ _id: false, day: { type: Number, min: 0, max: 6, required: true }, shifts: { type: [shiftSchema], default: [] } }],
      default: [],
    },
    /** The staff login (role "trainer") this profile belongs to; drives "My members". */
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    showOnFrontend: { type: Boolean, default: true },
  },
  { timestamps: true }
);

trainerSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } });

export default mongoose.model('Trainer', trainerSchema);
