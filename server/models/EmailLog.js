import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, index: true },
    templateKey: { type: String, required: true },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailCampaign' },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed'],
      default: 'queued',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    sentAt: { type: Date },
    subject: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('EmailLog', emailLogSchema);
