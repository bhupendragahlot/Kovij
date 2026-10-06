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

    /**
     * Member app password (bcrypt). Never selected unless asked for (`+passwordHash`) and never
     * serialised. Desk-registered members start with their date of birth (DDMMYYYY); see
     * services/memberPasswordService.js.
     */
    passwordHash: { type: String, select: false },
    /** When the current password was set (any way). Absent = no password yet. */
    passwordSetAt: { type: Date },
    /** The current password is still the date-of-birth default. */
    passwordIsDefault: { type: Boolean },
    /** Member sessions issued before this are signed out (member changed it, or staff reset it). */
    passwordChangedAt: { type: Date },
  },
  {
    timestamps: true,
    // The hash never leaves the server, even from a document that loaded it.
    toJSON: { transform: (doc, ret) => (delete ret.passwordHash, ret) },
    toObject: { transform: (doc, ret) => (delete ret.passwordHash, ret) },
  }
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

// Aggregations ignore `select: false`, so every pipeline over members drops the password hash
// itself (after a leading $match/$geoNear/$search, which must stay first).
const MUST_BE_FIRST = ['$match', '$geoNear', '$search', '$searchMeta', '$vectorSearch'];
memberSchema.pre('aggregate', function hidePasswordHash() {
  const pipeline = this.pipeline();
  const at = pipeline[0] && MUST_BE_FIRST.includes(Object.keys(pipeline[0])[0]) ? 1 : 0;
  pipeline.splice(at, 0, { $unset: 'passwordHash' });
});

export default mongoose.model('Member', memberSchema);
