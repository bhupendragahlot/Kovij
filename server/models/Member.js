import mongoose from 'mongoose';
import { canonicalPhone } from '../utils/strings.js';

/** Store blanks as "absent" so partial unique indexes ignore them. */
const blankToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const memberSchema = new mongoose.Schema(
  {
    /** Set for members who sign in with Google; absent for desk-registered walk-ins. */
    firebaseUid: { type: String, trim: true, set: blankToUndefined },
    /** Google account id (the token "sub") for members using the Sign in with Google button. */
    googleSub: { type: String, trim: true, set: blankToUndefined },
    email: { type: String, lowercase: true, trim: true, set: blankToUndefined },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, set: canonicalPhone },
    /** Short human-friendly id printed on cards and used at the desk, e.g. KFZ-0142. */
    memberCode: { type: String, trim: true },
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
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true, set: canonicalPhone },
    },
    notes: { type: String, default: '' },
    source: { type: String, enum: ['google', 'app', 'desk', 'lead'], default: 'google' },
    /** When the member actually joined the gym (may predate this record). Falls back to createdAt. */
    joinedAt: { type: Date },
    referral: {
      /** How they heard about the gym. */
      channel: { type: String, enum: ['friend', 'instagram', 'google', 'walk_in', 'website', 'other'] },
      referredByMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
      referredByName: { type: String, trim: true },
    },
    /** Trainer responsible for this member's programme (workouts, diet, progress). */
    assignedTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer' },
    /** Member's own choices about what we send them. Reminders about their money/plan can't be turned off. */
    notificationPrefs: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      birthday: { type: Boolean, default: true },
      workoutUpdates: { type: Boolean, default: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const presentString = (field) => ({ partialFilterExpression: { [field]: { $type: 'string' } } });

memberSchema.index({ firebaseUid: 1 }, { unique: true, ...presentString('firebaseUid') });
memberSchema.index({ googleSub: 1 }, { unique: true, ...presentString('googleSub') });
memberSchema.index({ email: 1 }, { unique: true, ...presentString('email') });
memberSchema.index({ memberCode: 1 }, { unique: true, ...presentString('memberCode') });
// Phones are not unique: families often share one number. Duplicates are flagged in the UI instead.
memberSchema.index({ phone: 1 });
memberSchema.index({ createdAt: -1 });
memberSchema.index({ assignedTrainerId: 1 });

export default mongoose.model('Member', memberSchema);
