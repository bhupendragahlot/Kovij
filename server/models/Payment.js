import mongoose from 'mongoose';

export const PAYMENT_TYPES = ['registration', 'membership', 'renewal', 'personal_training', 'other'];
export const PAYMENT_MODES = ['cash', 'upi', 'card'];
export const PAYMENT_STATUSES = ['paid', 'pending', 'failed'];

const paymentSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', index: true },
    type: { type: String, enum: PAYMENT_TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    /** Mode is unknown until a pending due is collected. */
    mode: { type: String, enum: PAYMENT_MODES },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    txnRef: { type: String, default: '' },
    note: { type: String, default: '' },
    invoiceNo: { type: String },
    paidAt: { type: Date, index: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Client-supplied Idempotency-Key of the request that created this row (DB-level duplicate guard). */
    idempotencyKey: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ invoiceNo: 1 }, { unique: true, partialFilterExpression: { invoiceNo: { $type: 'string' } } });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
paymentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
