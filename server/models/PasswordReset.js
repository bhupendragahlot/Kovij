import mongoose from 'mongoose';

/**
 * Single-use staff password reset link. Only the SHA-256 of the token is stored, so a
 * database leak doesn't hand out working links. Removed by MongoDB an hour after expiry.
 */
const passwordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    /** self (forgot password) or the admin who sent it */
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ip: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export default mongoose.model('PasswordReset', passwordResetSchema);
