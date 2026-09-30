import * as attendance from '../services/attendanceService.js';
import { currentGymMonth } from '../services/attendanceRules.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ── Staff (/api/admin/attendance) ──────────────────────────────────────────

/** GET /api/admin/attendance?date=YYYY-MM-DD&memberId= — one day: visits, per-hour counts, desk log. */
export const listAttendance = asyncHandler(async (req, res) => {
  const { date, memberId } = req.validated.query;
  res.json({ success: true, ...(await attendance.dayView({ date, memberId })) });
});

/**
 * POST /api/admin/attendance — check a member in at the desk.
 * One visit per member per day: repeating the request returns the open visit (200). After a
 * check-out it reopens the visit (member came back). Members without an active plan are refused
 * (409 MEMBERSHIP_INACTIVE) unless the desk overrides with a reason.
 */
export const checkIn = asyncHandler(async (req, res) => {
  const { memberId, override, overrideReason, method } = req.validated.body;
  const { status, ...result } = await attendance.checkIn({ memberId, method, override, overrideReason, staff: req.staffUser });
  res.status(status).json({ success: true, ...result });
});

/** POST /api/admin/attendance/scan — a QR code (or, at the desk, a typed member code). */
export const scan = asyncHandler(async (req, res) => {
  const { code, mode, source } = req.validated.body;
  const { status, ...result } = await attendance.scan({ code, mode, source, staff: req.staffUser });
  res.status(status).json({ success: true, ...result });
});

/** POST /api/admin/attendance/:id/check-out */
export const checkOut = asyncHandler(async (req, res) => {
  const result = await attendance.checkOut({ attendanceId: req.params.id, method: req.validated.body.method, staff: req.staffUser });
  res.json({ success: true, ...result });
});

/** DELETE /api/admin/attendance/:id/check-out — undo a mistaken check-out (today only). */
export const undoCheckOut = asyncHandler(async (req, res) => {
  const result = await attendance.undoCheckOut({ attendanceId: req.params.id, staff: req.staffUser });
  res.json({ success: true, ...result });
});

/** DELETE /api/admin/attendance/:id — undo a mistaken check-in (today only). */
export const undoCheckIn = asyncHandler(async (req, res) => {
  await attendance.undoCheckIn({ attendanceId: req.params.id, staff: req.staffUser });
  res.json({ success: true });
});

/** GET /api/admin/attendance/month?month=YYYY-MM — visits per day and totals. */
export const monthView = asyncHandler(async (req, res) => {
  const month = req.validated.query.month || currentGymMonth();
  res.json({ success: true, ...(await attendance.monthView({ month })) });
});

/** GET /api/admin/attendance/month/members?month=&q=&page=&limit= — visits per member. */
export const monthMembers = asyncHandler(async (req, res) => {
  const { month, q, page, limit } = req.validated.query;
  res.json({ success: true, month: month || currentGymMonth(), ...(await attendance.monthMembers({ month: month || currentGymMonth(), q, page, limit })) });
});

/** GET /api/admin/attendance/export?month=YYYY-MM&kind=visits|members — CSV download. */
export const exportCsv = asyncHandler(async (req, res) => {
  const month = req.validated.query.month || currentGymMonth();
  const { kind } = req.validated.query;
  const csv = await attendance.exportMonthCsv({ month, kind });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="attendance-${kind === 'members' ? 'members-' : ''}${month}.csv"`);
  res.set('Cache-Control', 'no-store');
  res.send(csv);
});

/** GET /api/admin/attendance/members/:memberId/summary */
export const memberSummary = asyncHandler(async (req, res) => {
  const member = await attendance.ensureMember(req.params.memberId);
  res.json({ success: true, member, ...(await attendance.memberStats(member._id)) });
});

/** GET /api/admin/attendance/members/:memberId/month?month=YYYY-MM */
export const memberMonth = asyncHandler(async (req, res) => {
  const member = await attendance.ensureMember(req.params.memberId);
  const month = req.validated.query.month || currentGymMonth();
  res.json({ success: true, ...(await attendance.memberMonth(member._id, { month, staffView: true })) });
});

/** GET /api/admin/attendance/members/:memberId/history?page=&limit= */
export const memberHistory = asyncHandler(async (req, res) => {
  const member = await attendance.ensureMember(req.params.memberId);
  const { page, limit } = req.validated.query;
  res.json({ success: true, ...(await attendance.memberHistory(member._id, { page, limit, staffView: true })) });
});

/** GET /api/admin/attendance/members/:memberId/qr — the member's current entry code, for printing a card. */
export const memberQr = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, ...(await attendance.memberQr(req.params.memberId)) });
});

/** POST /api/admin/attendance/members/:memberId/qr/reissue — replace a lost or shared code. */
export const reissueQr = asyncHandler(async (req, res) => {
  const result = await attendance.reissueQr({ memberId: req.params.memberId, reason: req.validated.body.reason, staff: req.staffUser });
  res.set('Cache-Control', 'no-store');
  res.status(201).json({ success: true, ...result });
});

// ── Member app (/api/member/attendance) ────────────────────────────────────

const selfId = async (req) => (await attendance.ensureMember(req.member.memberId))._id;

/** GET /api/member/attendance/today */
export const myToday = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await attendance.memberToday(await selfId(req))) });
});

/** GET /api/member/attendance/history?page=&limit= */
export const myHistory = asyncHandler(async (req, res) => {
  const { page, limit } = req.validated.query;
  res.json({ success: true, ...(await attendance.memberHistory(await selfId(req), { page, limit })) });
});

/** GET /api/member/attendance/month?month=YYYY-MM */
export const myMonth = asyncHandler(async (req, res) => {
  const month = req.validated.query.month || currentGymMonth();
  res.json({ success: true, ...(await attendance.memberMonth(await selfId(req), { month })) });
});

/** GET /api/member/attendance/streak */
export const myStreak = asyncHandler(async (req, res) => {
  const stats = await attendance.memberStats(await selfId(req));
  res.json({
    success: true,
    current: stats.streak.current,
    longest: stats.streak.longest,
    last30Days: stats.last30Days,
    thisMonth: stats.thisMonth,
    total: stats.total,
    lastVisitAt: stats.lastVisitAt,
  });
});

/** GET /api/member/attendance/qr — the string the member app shows as a QR code. */
export const myQr = asyncHandler(async (req, res) => {
  const { token, version, memberCode, name } = await attendance.memberQr(await selfId(req));
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, token, version, memberCode, name, format: 'qr' });
});
