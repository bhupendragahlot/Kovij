import mongoose from 'mongoose';

/**
 * One event in a member's membership timeline.
 *   join / renew / upgrade / downgrade   a plan was sold or requested (`membershipId` is the new plan)
 *   freeze / unfreeze                    a plan was put on hold / resumed (`days` = days booked / actually frozen)
 *   extend                               complimentary days were added (`days`)
 *   cancel                               a plan was cancelled
 */
export const PLAN_CHANGE_TYPES = ['join', 'renew', 'upgrade', 'downgrade', 'freeze', 'unfreeze', 'extend', 'cancel'];
export const SALE_CHANGE_TYPES = ['join', 'renew', 'upgrade', 'downgrade'];

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
      enum: PLAN_CHANGE_TYPES,
      required: true,
    },
    /** Days frozen, unfrozen or added. */
    days: { type: Number },
    /** Plan price at the time of a sale or request (rupees). */
    amount: { type: Number },
    /** Freeze window, or the new plan's dates. */
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    /** desk = staff, self = the member in the app, system = scheduled job. */
    source: { type: String, enum: ['desk', 'self', 'system'], default: 'desk' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    prorationAmount: { type: Number, default: 0 },
    /** Staff-facing reason (freeze, extension, cancellation). Never shown to the member. */
    notes: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
    /** Idempotency-Key of the request that created this event (DB-level duplicate guard). */
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

planHistorySchema.index({ changeType: 1, changedAt: -1 });
planHistorySchema.index({ memberId: 1, changedAt: -1 });
planHistorySchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export default mongoose.model('PlanHistory', planHistorySchema);
