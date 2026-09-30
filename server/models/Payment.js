import mongoose from 'mongoose';

export const PAYMENT_TYPES = ['registration', 'membership', 'renewal', 'personal_training', 'other'];
/** `online` = paid through the payment gateway (card, UPI or netbanking inside checkout). */
export const PAYMENT_MODES = ['cash', 'upi', 'card', 'online'];
/**
 * paid      money received (counts as revenue)
 * pending   a due still owed (its amount is what is left to pay)
 * failed    withdrawn or cancelled before it was paid
 * refunded  money was received and later given back (never counts as revenue)
 */
export const PAYMENT_STATUSES = ['paid', 'pending', 'failed', 'refunded'];
/** A member said they paid a due by UPI; staff confirm (collect) or reject it. */
export const VERIFICATION_STATES = ['submitted', 'confirmed', 'rejected'];

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

    // Part payments. Collecting part of a due creates a new paid row (its own receipt) that points
    // at the due; the due keeps its id and its `amount` drops to what is still owed.
    /** On a part payment: the due it was taken from. */
    dueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', index: true },
    /** On a due that has been part-paid: the amount first raised. */
    originalAmount: { type: Number, min: 0 },
    /** On a part payment: what was still owed right after it (printed on the receipt). */
    balanceAfter: { type: Number, min: 0 },

    /** Money given back by hand (cash/UPI). Status becomes `refunded`; nothing goes through a gateway. */
    refund: {
      amount: { type: Number, min: 0 },
      reason: { type: String, trim: true },
      at: { type: Date },
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    /** Member-submitted UPI reference waiting for staff to check it against the bank app. */
    verification: {
      state: { type: String, enum: VERIFICATION_STATES },
      utr: { type: String, trim: true },
      amount: { type: Number, min: 0 },
      submittedAt: { type: Date },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String, trim: true },
    },

    /** Set when the money came through the payment gateway. */
    gateway: {
      provider: { type: String },
      orderId: { type: String },
      paymentId: { type: String },
      method: { type: String },
    },

    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ invoiceNo: 1 }, { unique: true, partialFilterExpression: { invoiceNo: { $type: 'string' } } });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
// A gateway payment id is recorded against exactly one row, however many times it is confirmed.
paymentSchema.index({ 'gateway.paymentId': 1 }, { unique: true, partialFilterExpression: { 'gateway.paymentId': { $type: 'string' } } });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ status: 1, 'verification.state': 1 });
paymentSchema.index({ 'verification.utr': 1 }, { partialFilterExpression: { 'verification.utr': { $type: 'string' } } });

export default mongoose.model('Payment', paymentSchema);
