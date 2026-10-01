import Member from '../models/Member.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toGymTime, gymDayKey } from '../utils/time.js';
import { sendCsv, toCsv } from '../services/csvExport.js';
import { classifyRenewal, endedPlansWithNext, notComingIn, reportOverview, resolvePeriod } from '../services/reportService.js';

const day = (d) => (d ? toGymTime(d).format('YYYY-MM-DD') : '');
const OUTCOME = { on_time: 'Renewed on time', late: 'Renewed late', undecided: 'Not yet (still in the grace period)', lost: 'Did not renew' };

/** GET /api/admin/reports/overview?from&to&days */
export const getOverview = asyncHandler(async (req, res) => {
  const { from, to, days } = req.validated.query;
  res.json({ success: true, ...(await reportOverview({ from, to, atRiskDays: days })) });
});

/** GET /api/admin/reports/not-coming-in?days&page&limit */
export const getNotComingIn = asyncHandler(async (req, res) => {
  const { days, page, limit } = req.validated.query;
  res.json({ success: true, ...(await notComingIn({ days, page, limit })) });
});

/** GET /api/admin/reports/renewals.csv?from&to — every plan that ended in the period and what happened next. */
export const exportRenewals = asyncHandler(async (req, res) => {
  const now = new Date();
  const period = resolvePeriod(req.validated.query, now);
  const ended = await endedPlansWithNext(period.from, period.to, now);
  const members = await Member.find({ _id: { $in: ended.map((p) => p.memberId) } }).select('name phone memberCode').lean();
  const byId = new Map(members.map((m) => [String(m._id), m]));
  const rows = ended
    .map((p) => ({ ...p, member: byId.get(String(p.memberId)), outcome: classifyRenewal(p, now) }))
    .sort((a, b) => a.endDate - b.endDate);
  const csv = toCsv(
    [
      { header: 'Member', value: (r) => r.member?.name || '' },
      { header: 'Member ID', value: (r) => r.member?.memberCode || '' },
      { header: 'Phone', value: (r) => r.member?.phone || '' },
      { header: 'Plan', value: (r) => r.planName },
      { header: 'Plan ended', value: (r) => day(r.endDate) },
      { header: 'Next plan started', value: (r) => day(r.nextStart) },
      { header: 'Outcome', value: (r) => OUTCOME[r.outcome] },
    ],
    rows
  );
  sendCsv(res, `renewals-${period.fromKey}-to-${period.toKey}.csv`, csv);
});

/** GET /api/admin/reports/not-coming-in.csv?days */
export const exportNotComingIn = asyncHandler(async (req, res) => {
  const { days } = req.validated.query;
  const data = await notComingIn({ days, page: 1, limit: 5000 });
  const csv = toCsv(
    [
      { header: 'Member', value: (r) => r.name },
      { header: 'Member ID', value: (r) => r.memberCode },
      { header: 'Phone', value: (r) => r.phone },
      { header: 'Plan', value: (r) => r.planName },
      { header: 'Plan ends', value: (r) => day(r.planEnds) },
      { header: 'Last visit', value: (r) => (r.lastVisit ? day(r.lastVisit) : 'Never') },
      { header: 'Days away', value: (r) => (r.daysAway ?? '') },
      { header: 'Trainer', value: (r) => r.trainer },
    ],
    data.items
  );
  sendCsv(res, `not-coming-in-${days}-days-${gymDayKey()}.csv`, csv);
});
