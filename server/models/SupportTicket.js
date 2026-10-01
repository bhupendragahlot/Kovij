import mongoose from 'mongoose';

export const SUPPORT_CATEGORIES = ['membership', 'payment', 'attendance', 'training', 'facilities', 'app', 'other'];
/**
 * open            waiting for the gym
 * waiting_member  the gym replied and asked something back
 * resolved        sorted; the member can still reply for a while, which reopens it
 * closed          finished for good (after RESOLVED_REOPEN_DAYS, or closed by staff)
 */
export const SUPPORT_STATUSES = ['open', 'waiting_member', 'resolved', 'closed'];

const messageSchema = new mongoose.Schema(
  {
    by: { type: String, enum: ['member', 'staff'], required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffName: { type: String, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

/** A member's question or problem and the conversation about it. Staff-internal notes live elsewhere. */
const supportTicketSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    category: { type: String, enum: SUPPORT_CATEGORIES, default: 'other' },
    subject: { type: String, required: true, trim: true, maxlength: 140 },
    status: { type: String, enum: SUPPORT_STATUSES, default: 'open', index: true },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageBy: { type: String, enum: ['member', 'staff'], default: 'member' },
    /** Something new the other side hasn't opened yet. */
    unreadForStaff: { type: Boolean, default: true },
    unreadForMember: { type: Boolean, default: false },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ memberId: 1, lastMessageAt: -1 });

export default mongoose.model('SupportTicket', supportTicketSchema);
