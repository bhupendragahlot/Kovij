import Attendance from '../models/Attendance.js';
import Member from '../models/Member.js';
import { currentMembershipState } from '../services/membershipService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { GYM_TZ, gymDayKey } from '../utils/time.js';

const MEMBER_FIELDS = 'name memberCode phone profilePhoto';

function membershipSummary({ state, membership }) {
  if (!membership) return { state };
  const daysLeft = Math.ceil((new Date(membership.endDate) - Date.now()) / 86_400_000);
  return { state, planName: membership.planName, endDate: membership.endDate, daysLeft };
}

/** GET /api/admin/attendance?date=YYYY-MM-DD */
export const listAttendance = asyncHandler(async (req, res) => {
  const day = req.validated.query.date || gymDayKey();
  const [items, byHour] = await Promise.all([
    Attendance.find({ dayKey: day }).sort({ checkedInAt: -1 }).populate('memberId', MEMBER_FIELDS).lean(),
    Attendance.aggregate([
      { $match: { dayKey: day } },
      { $group: { _id: { $hour: { date: '$checkedInAt', timezone: GYM_TZ } }, n: { $sum: 1 } } },
    ]),
  ]);
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const h of byHour) hours[h._id].count = h.n;
  res.json({ success: true, date: day, total: items.length, items: items.filter((i) => i.memberId), byHour: hours });
});

/**
 * POST /api/admin/attendance — check a member in.
 * One visit per member per day: repeating the request returns the existing visit (200).
 * Members without an active plan are refused unless the desk overrides with a reason.
 */
export const checkIn = asyncHandler(async (req, res) => {
  const { memberId, override, overrideReason } = req.validated.body;
  const member = await Member.findById(memberId).select(MEMBER_FIELDS).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');

  const standing = await currentMembershipState(memberId);
  const summary = membershipSummary(standing);
  const dayKey = gymDayKey();

  const existing = await Attendance.findOne({ memberId, dayKey }).lean();
  if (existing) {
    return res.json({ success: true, alreadyCheckedIn: true, attendance: existing, member, membership: summary });
  }

  if (standing.state !== 'active' && !override) {
    throw new AppError(
      standing.state === 'none' ? `${member.name} has no plan yet` : `${member.name}'s plan is not active`,
      409,
      'MEMBERSHIP_INACTIVE',
      { member, membership: summary }
    );
  }
  if (standing.state !== 'active' && override && !overrideReason) {
    throw new AppError('Add a reason to let this member in without an active plan', 422, 'VALIDATION_ERROR', {
      fields: { overrideReason: 'Add a reason' },
    });
  }

  try {
    const attendance = await Attendance.create({
      memberId,
      dayKey,
      method: 'desk',
      membershipStatus: ['active', 'expired', 'pending'].includes(standing.state) ? standing.state : 'none',
      overrideReason: overrideReason || '',
      recordedBy: req.staffUser.id,
    });
    res.status(201).json({ success: true, alreadyCheckedIn: false, attendance, member, membership: summary });
  } catch (e) {
    // Two desks tapped at the same moment: the unique index kept one; return it.
    if (e?.code !== 11000) throw e;
    const attendance = await Attendance.findOne({ memberId, dayKey }).lean();
    res.json({ success: true, alreadyCheckedIn: true, attendance, member, membership: summary });
  }
});

/** DELETE /api/admin/attendance/:id — undo a mistaken check-in (same day only). */
export const undoCheckIn = asyncHandler(async (req, res) => {
  const row = await Attendance.findById(req.params.id);
  if (!row) throw new AppError('Check-in not found', 404, 'NOT_FOUND');
  if (row.dayKey !== gymDayKey()) throw new AppError('Only today’s check-ins can be undone', 409, 'TOO_LATE');
  await row.deleteOne();
  res.json({ success: true });
});
