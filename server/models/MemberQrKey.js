import mongoose from 'mongoose';

/**
 * The current version of a member's entry QR code. A code carries the version it was issued
 * with; replacing the code bumps the version, so a lost or shared card stops working at once.
 * Members without a row are on version 1.
 */
const memberQrKeySchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    rotatedAt: { type: Date },
    rotatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, default: '' },
  },
  { timestamps: true }
);

memberQrKeySchema.index({ memberId: 1 }, { unique: true });

export default mongoose.model('MemberQrKey', memberQrKeySchema);
