import mongoose from 'mongoose';

export const LOGIN_EVENT_RETENTION_DAYS = 180;

/**
 * Every staff sign-in attempt. `email` is what was typed (lowercased), so failed attempts
 * against unknown addresses are visible too; `userId` is set when the account exists.
 */
const loginEventSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, trim: true, lowercase: true },
    success: { type: Boolean, required: true },
    /** ok | wrong_password | unknown_account | inactive | locked | password_reset */
    reason: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { versionKey: false }
);

loginEventSchema.index({ at: 1 }, { expireAfterSeconds: LOGIN_EVENT_RETENTION_DAYS * 86400 });
loginEventSchema.index({ email: 1, at: -1 });
loginEventSchema.index({ userId: 1, at: -1 });

export default mongoose.model('LoginEvent', loginEventSchema);
