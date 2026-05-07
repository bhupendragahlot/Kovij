import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    profilePhoto: { type: String, default: '' },
    address: {
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      line1: { type: String, trim: true },
    },
    dob: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_say'],
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Member', memberSchema);
