import mongoose from 'mongoose';

/** How a check-in or check-out was recorded: front desk search, QR scanned at the desk, or the entrance kiosk. */
export const ATTENDANCE_METHODS = ['desk', 'qr', 'kiosk', 'self'];

/**
 * A member's visit on a gym-local calendar day. The unique (memberId, dayKey) index makes
 * check-in naturally idempotent: tapping twice, or an offline retry, never double-counts.
 *
 * A visit can be closed (checked out) and reopened when the member comes back the same day.
 * `minutesInGym` adds up the closed stretches, so a morning and an evening session count
 * their real time, not the gap between them. A visit never gets an invented check-out time:
 * one left open at closing is shown as "no check-out".
 */
const attendanceSchema = new mongoose.Schema(
  {
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    dayKey: { type: String, required: true },
    checkedInAt: { type: Date, required: true, default: Date.now },
    method: { type: String, enum: ATTENDANCE_METHODS, default: 'desk' },
    /** Membership state at the moment of entry, so reports can find entries without a valid plan. */
    membershipStatus: { type: String, enum: ['active', 'expired', 'pending', 'upcoming', 'paused', 'none'], default: 'active' },
    overrideReason: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    /** Start of the stretch in the gym that is open now (the first check-in, or the latest return). */
    lastInAt: { type: Date },
    checkedOutAt: { type: Date, default: null },
    checkOutMethod: { type: String, enum: [...ATTENDANCE_METHODS, null], default: null },
    checkedOutBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Minutes in the gym across every closed stretch of this day. */
    minutesInGym: { type: Number, default: 0, min: 0 },
    /** 1 + the number of times the member came back after checking out. */
    entries: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

attendanceSchema.index({ memberId: 1, dayKey: 1 }, { unique: true });
attendanceSchema.index({ dayKey: 1, checkedInAt: -1 });

export default mongoose.model('Attendance', attendanceSchema);
