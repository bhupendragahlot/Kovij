import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    type: {
      type: String,
      enum: ['registration', 'membership', 'renewal'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    mode: {
      type: String,
      enum: ['cash', 'upi', 'card'],
      required: true,
    },
    status: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'pending',
    },
    txnRef: { type: String, default: '' },
    invoiceNo: { type: String, unique: true, sparse: true },
    paidAt: { type: Date },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.pre('save', function (next) {
  if (!this.invoiceNo) {
    this.invoiceNo = `INV-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }
  next();
});

export default mongoose.model('Payment', paymentSchema);
