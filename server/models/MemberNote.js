import mongoose from 'mongoose';

export const NOTE_CATEGORIES = ['general', 'health', 'training', 'billing', 'complaint'];

/**
 * Staff-only notes on a member's profile (a timeline). Never exposed through any member route.
 * Notes in the "health" category are hidden from roles without members.health.view.
 */
const memberNoteSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: NOTE_CATEGORIES, default: 'general' },
    pinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, default: '' },
    authorRole: { type: String, default: '' },
    /** Set when the text or category is changed (not when pinned). */
    editedAt: { type: Date },
  },
  { timestamps: true }
);

memberNoteSchema.index({ memberId: 1, pinned: -1, createdAt: -1 });

export default mongoose.model('MemberNote', memberNoteSchema);
