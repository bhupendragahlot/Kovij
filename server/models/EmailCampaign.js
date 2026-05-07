import mongoose from 'mongoose';

const emailCampaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['offer', 'festival', 'info', 'bulk'],
      default: 'bulk',
    },
    subject: { type: String, required: true },
    bodyHtml: { type: String, required: true },
    audienceFilter: {
      type: String,
      enum: ['all', 'activeMembers', 'expired', 'noMembership'],
      default: 'all',
    },
    scheduledAt: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'queued', 'sending', 'sent', 'failed'],
      default: 'draft',
    },
    stats: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      queued: { type: Number, default: 0 },
    },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('EmailCampaign', emailCampaignSchema);
