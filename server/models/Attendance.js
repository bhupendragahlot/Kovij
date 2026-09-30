import mongoose from 'mongoose';

/**
 * A member's visit on a gym-local calendar day. The unique (memberId, dayKey) index makes
 * check-in naturally idempotent: tapping twice, or an offline retry, never double-counts.
 */
const attendanceSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    dayKey: { type: String, required: true },
    checkedInAt: { type: Date, required: true, default: Date.now },
    method: { type: String, enum: ['desk', 'self'], default: 'desk' },
    /** Membership state at the moment of entry, so reports can find entries without a valid plan. */
    membershipStatus: { type: String, enum: ['active', 'expired', 'pending', 'none'], default: 'active' },
    overrideReason: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ memberId: 1, dayKey: 1 }, { unique: true });
attendanceSchema.index({ dayKey: 1, checkedInAt: -1 });

export default mongoose.model('Attendance', attendanceSchema);
