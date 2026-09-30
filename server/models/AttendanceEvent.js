import mongoose from 'mongoose';
import { ATTENDANCE_METHODS } from './Attendance.js';

/**
 * The desk log: every check-in, check-out, undo, refusal and QR replacement, with who did it,
 * how and when. Visits can be deleted (undo) or reopened; this log keeps what happened.
 *
 *   check_in        first entry of the day (reason = "let in once" reason, if any)
 *   returned        came back after checking out the same day
 *   check_out       left
 *   undo_check_in   the visit was removed (details keep the original times)
 *   undo_check_out  a check-out was reversed
 *   refused         entry refused (reason says why: plan ended, old QR code, ...)
 *   qr_reissued     the member's QR code was replaced; older codes stop working
 */
export const ATTENDANCE_EVENT_TYPES = ['check_in', 'returned', 'check_out', 'undo_check_in', 'undo_check_out', 'refused', 'qr_reissued'];

const attendanceEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ATTENDANCE_EVENT_TYPES, required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
    attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
    /** Gym day the event belongs to (YYYY-MM-DD). */
    dayKey: { type: String, required: true },
    at: { type: Date, required: true, default: Date.now },
    method: { type: String, enum: ATTENDANCE_METHODS, default: 'desk' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Staff name at the time, so the log still reads well if the account is renamed or removed. */
    byName: { type: String, default: '' },
    reason: { type: String, default: '' },
    membershipStatus: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { versionKey: false }
);

attendanceEventSchema.index({ dayKey: 1, at: -1 });
attendanceEventSchema.index({ memberId: 1, at: -1 });

export default mongoose.model('AttendanceEvent', attendanceEventSchema);
