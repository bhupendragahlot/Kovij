import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = ['rent', 'salary', 'electricity', 'equipment', 'maintenance', 'other'];
/** How the gym paid. `bank` covers bank transfers and cheques. */
export const EXPENSE_MODES = ['cash', 'upi', 'card', 'bank'];

/** Money the gym spent. Deleting hides the row (deletedAt) so the books keep an audit trail. */
const expenseSchema = new mongoose.Schema(
  {
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    /** Start of the gym-local day the money was spent; used for month filters and totals. */
    spentOn: { type: Date, required: true },
    /** The same day as `YYYY-MM-DD` (gym time), for display and editing without time-zone drift. */
    dayKey: { type: String, required: true },
    mode: { type: String, enum: EXPENSE_MODES, default: 'cash' },
    vendor: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    /** Private upload (photo or PDF of the bill), streamed only through the staff API. */
    bill: {
      ref: { type: String },
      name: { type: String },
      mime: { type: String },
      size: { type: Number },
      uploadedAt: { type: Date },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

expenseSchema.index({ deletedAt: 1, spentOn: -1 });
expenseSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export default mongoose.model('Expense', expenseSchema);
