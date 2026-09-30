import mongoose from 'mongoose';

/**
 * One message to one member: the in-app inbox entry plus how each channel (email, push) went.
 * Created only through services/notify.js.
 */
const channelSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['queued', 'sent', 'skipped', 'failed'], default: 'skipped' },
    /** Why a channel was skipped or failed, e.g. "no_email", "opted_out", "no_subscription". */
    reason: { type: String, default: '' },
    at: { type: Date },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    /** Stable category, e.g. expiry_reminder, payment_due, birthday, announcement, workout, diet, receipt. */
    kind: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 2000 },
    /** Member-app path to open, e.g. /member/membership. */
    link: { type: String, default: '' },
    readAt: { type: Date },
    channels: {
      email: { type: channelSchema, default: () => ({}) },
      push: { type: channelSchema, default: () => ({}) },
    },
    /**
     * Idempotency for automated sends: the same key is never delivered twice
     * (e.g. `expiry:<membershipId>:7d`). Cron retries and overlapping runs are safe.
     */
    dedupeKey: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

notificationSchema.index({ memberId: 1, createdAt: -1 });
notificationSchema.index({ memberId: 1, readAt: 1 });
notificationSchema.index({ kind: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export default mongoose.model('Notification', notificationSchema);
