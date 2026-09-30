import mongoose from 'mongoose';

/**
 * One browser/device a member allowed to receive web push notifications. The endpoint is the
 * push service URL the browser gave us; it is unique, so a shared phone moves to whoever
 * subscribed last. Subscriptions the push service reports as gone (404/410) are removed.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    endpoint: { type: String, required: true, maxlength: 1000 },
    keys: {
      p256dh: { type: String, required: true, maxlength: 200 },
      auth: { type: String, required: true, maxlength: 100 },
    },
    expirationTime: { type: Date },
    userAgent: { type: String, default: '', maxlength: 300 },
    lastSuccessAt: { type: Date },
    /** Consecutive non-fatal failures (push service errors other than "gone"). */
    failCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
