import mongoose from 'mongoose';
import { canonicalPhone } from '../utils/strings.js';

export const LEAD_STATUSES = ['new', 'contacted', 'trial', 'won', 'lost'];
export const LEAD_SOURCES = ['walk_in', 'phone', 'website', 'instagram', 'referral', 'other'];

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, set: canonicalPhone },
    email: { type: String, trim: true, lowercase: true },
    source: { type: String, enum: LEAD_SOURCES, default: 'walk_in' },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    interestPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    nextFollowUpAt: { type: Date, index: true },
    lostReason: { type: String, default: '' },
    message: { type: String, default: '' },
    notes: [noteSchema],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    convertedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, nextFollowUpAt: 1 });
leadSchema.index({ phone: 1 });

export default mongoose.model('Lead', leadSchema);
