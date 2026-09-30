import mongoose from 'mongoose';

/**
 * Lifecycle:
 *   pending  → created by an online self-join or renewal request; becomes active when its dues are paid
 *   upcoming → confirmed renewal that starts when the current plan ends
 *   active   → current plan (at most one per member)
 *   paused   → current plan while a freeze is running (see `freeze`)
 *   expired / cancelled
 */
export const MEMBERSHIP_STATUSES = ['pending', 'upcoming', 'active', 'expired', 'cancelled', 'paused'];

/**
 * A booked or running freeze. Dates are gym-day boundaries: the plan is on hold from the start of
 * `startDate`'s day until the start of `endDate`'s day. When the freeze is booked, the plan's
 * endDate moves out by `days`; an early unfreeze gives the unused days back.
 */
const freezeSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    reason: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/** A finished freeze, kept for the timeline and for "how many days has this plan been frozen". */
const pastFreezeSchema = new mongoose.Schema(
  {
    startDate: { type: Date, required: true },
    plannedEndDate: { type: Date, required: true },
    resumedAt: { type: Date, required: true },
    days: { type: Number, required: true },
    daysFrozen: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '' },
    /** manual = staff unfroze it, scheduled = it ran its course, cancelled = removed before it started */
    endedHow: { type: String, enum: ['manual', 'scheduled', 'cancelled'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

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
    /** The booked or running freeze, if any (at most one at a time). */
    freeze: { type: freezeSchema, default: undefined },
    freezeHistory: { type: [pastFreezeSchema], default: undefined },
    /** Gym days this plan has actually been frozen, across all freezes. */
    frozenDays: { type: Number, default: 0, min: 0 },
    /** Complimentary days added with "Extend". */
    bonusDays: { type: Number, default: 0, min: 0 },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
// Finds freezes that are due to start or end (daily job and lazy reads).
membershipSchema.index({ 'freeze.endDate': 1 }, { partialFilterExpression: { 'freeze.endDate': { $exists: true } } });

export default mongoose.model('Membership', membershipSchema);
