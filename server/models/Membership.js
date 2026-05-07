import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'paused'],
      default: 'active',
      index: true,
    },
    /** Set when a 3-day expiry reminder email was sent */
    lastReminderSentAt: { type: Date },
    /** Generic last notification (e.g. expired email) */
    lastNotifiedAt: { type: Date },
  },
  { timestamps: true }
);

membershipSchema.index({ memberId: 1, status: 1 });
membershipSchema.index({ endDate: 1, status: 1 });

export default mongoose.model('Membership', membershipSchema);
