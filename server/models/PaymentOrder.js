import mongoose from 'mongoose';

/**
 * One checkout started by a member for one due (Razorpay order). The order is the lock that makes
 * gateway confirmations exactly-once: the checkout callback and the webhook both land here, and
 * only the first one to mark it paid records money.
 */
const paymentOrderSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ['razorpay'], default: 'razorpay' },
    orderId: { type: String, required: true },
    /** The due being paid. */
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    /** Rupees (the gateway works in paise). */
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid'], default: 'created' },
    /** The gateway payment that settled this order. */
    gatewayPaymentId: { type: String },
    paidAt: { type: Date },
    /** Which path confirmed it first: the member's checkout callback or the webhook. */
    confirmedBy: { type: String, enum: ['checkout', 'webhook'] },
  },
  { timestamps: true }
);

paymentOrderSchema.index({ provider: 1, orderId: 1 }, { unique: true });
paymentOrderSchema.index({ gatewayPaymentId: 1 }, { unique: true, partialFilterExpression: { gatewayPaymentId: { $type: 'string' } } });

export default mongoose.model('PaymentOrder', paymentOrderSchema);
