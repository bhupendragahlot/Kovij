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

/** Automatic sorting of the enquiry text (services/leadTriage.js). Labels only; staff decide. */
const triageSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['done', 'failed'] },
    version: Number,
    model: String,
    at: Date,
    error: { type: String, default: '' },
    topic: String,
    topicConfidence: Number,
    readiness: Number,
    readinessLevel: { type: String, enum: ['browsing', 'interested', 'ready'] },
    timePref: { type: String, enum: ['morning', 'evening', null] },
    wantsCallback: Boolean,
    spamProbability: Number,
    spam: { type: Boolean, default: false },
    /** 'staff' once someone marks spam / not spam by hand; automatic re-runs then leave it alone. */
    spamSetBy: { type: String, enum: ['auto', 'staff'] },
    /** Fields the triage filled in (e.g. interestPlanId), so the UI can show they were suggested. */
    filled: [String],
    /** Raw answers (probabilities, confidence) kept for tuning thresholds. */
    answers: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
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
    /** 0 low (business, spam) … 3 high (ready to start, member issue). Breaks ties within a follow-up day. */
    priority: { type: Number, default: 2, min: 0, max: 3 },
    triage: { type: triageSchema, default: undefined },
  },
  { timestamps: true }
);

leadSchema.index({ status: 1, nextFollowUpAt: 1 });
leadSchema.index({ phone: 1 });

export default mongoose.model('Lead', leadSchema);
