import mongoose from 'mongoose';

export const PHOTO_POSES = ['front', 'side', 'back'];

/**
 * A private progress photo: one per member, day and pose (a new upload replaces it).
 * The file lives outside every public folder and is only streamed through authenticated routes.
 */
const progressPhotoSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    day: { type: String, required: true },
    date: { type: Date, required: true },
    pose: { type: String, enum: PHOTO_POSES, required: true },
    /** Opaque private reference, e.g. "private:progress-photos/1727…-ab12.jpg". Never a public URL. */
    file: { type: String, required: true },
    mime: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    bytes: { type: Number, min: 0 },
    uploadedByKind: { type: String, enum: ['member', 'staff'], required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId },
    uploadedByName: { type: String, default: '' },
  },
  { timestamps: true }
);

progressPhotoSchema.index({ memberId: 1, day: 1, pose: 1 }, { unique: true });
progressPhotoSchema.index({ memberId: 1, date: -1 });

export default mongoose.model('ProgressPhoto', progressPhotoSchema);
