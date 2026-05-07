import mongoose from 'mongoose';

const planHistorySchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    fromPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    toPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    changeType: {
      type: String,
      enum: ['upgrade', 'downgrade', 'renew', 'join'],
      required: true,
    },
    prorationAmount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model('PlanHistory', planHistorySchema);
