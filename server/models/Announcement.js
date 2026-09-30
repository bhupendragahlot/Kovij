import mongoose from 'mongoose';

export const ANNOUNCEMENT_CATEGORIES = ['event', 'offer', 'holiday', 'notice'];
/** all = every member; active = has a current plan; lapsed = had a plan, nothing current now. */
export const ANNOUNCEMENT_AUDIENCES = ['all', 'active', 'lapsed'];
export const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'unpublished'];
export const DELIVERY_STATES = ['none', 'pending', 'running', 'done', 'stopped', 'failed'];

/**
 * A gym-wide notice (event, offer, holiday, notice). Members see published, unexpired ones in
 * the app; on publish each member in the audience also gets an in-app notification (and push,
 * and email when `sendEmail`), delivered in the background by services/announcementService.js.
 */
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: 'notice' },
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, default: 'all' },
    /** Optional https image shown in the app and the email. */
    imageUrl: { type: String, default: '', maxlength: 1000 },
    pinned: { type: Boolean, default: false },
    status: { type: String, enum: ANNOUNCEMENT_STATUSES, default: 'draft' },
    /** When it goes live. Empty on a draft means "as soon as it is published". */
    publishAt: { type: Date },
    /** After this moment members no longer see it. */
    expiresAt: { type: Date },
    sendEmail: { type: Boolean, default: false },
    publishedAt: { type: Date },
    unpublishedAt: { type: Date },
    delivery: {
      state: { type: String, enum: DELIVERY_STATES, default: 'none' },
      audienceCount: { type: Number, default: 0 },
      /** Members processed so far (notified + skipped + failed). */
      processed: { type: Number, default: 0 },
      notified: { type: Number, default: 0 },
      /** Opted out of announcements, deactivated, or already notified. */
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      startedAt: { type: Date },
      finishedAt: { type: Date },
      /** A worker holds the delivery until this time, so two processes never deliver at once. */
      leaseUntil: { type: Date },
      error: { type: String, default: '' },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

announcementSchema.index({ status: 1, publishAt: -1 });
announcementSchema.index({ 'delivery.state': 1 });

export default mongoose.model('Announcement', announcementSchema);
