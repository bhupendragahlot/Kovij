import mongoose from 'mongoose';

/**
 * Lifecycle:
 *   pending  → created by an online self-join; becomes active when the desk collects payment
 *   upcoming → confirmed renewal that starts when the current plan ends
 *   active   → current plan (at most one per member)
 *   expired / cancelled / paused
 */
export const MEMBERSHIP_STATUSES = ['pending', 'upcoming', 'active', 'expired', 'cancelled', 'paused'];

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
    /** Snapshot of the plan at purchase so later price edits don't rewrite history. */
    planName: { type: String, default: '' },
    price: { type: Number, min: 0 },
    durationDays: { type: Number, min: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: MEMBERSHIP_STATUSES,
      default: 'active',
      index: true,
    },
    source: { type: String, enum: ['self', 'desk'], default: 'self' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Set when a 3-day expiry reminder email was sent */
    lastReminderSentAt: { type: Date },
    /** Generic last notification (e.g. expired email) */
    lastNotifiedAt: { type: Date },
  },
  { timestamps: true }
);

membershipSchema.index({ memberId: 1, status: 1 });
membershipSchema.index({ endDate: 1, status: 1 });
membershipSchema.index({ startDate: 1, status: 1 });

export default mongoose.model('Membership', membershipSchema);
