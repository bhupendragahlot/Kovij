// Reports (owners and managers) and the dashboard's money and frozen-member rules.
import { adminToken, call, check, createMember, createPlan, finish, key, staffToken, uniq } from '../lib.mjs';

const T = await adminToken();
const manager = await staffToken('manager', T);
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);

const before = (await call('GET', '/admin/reports/overview', { token: T })).body;
check('owner gets the reports overview', before.success === true && typeof before.members?.activeNow === 'number', before);

// New activity in the period: two paying members on a new plan, one check-in, one enquiry.
const plan = await createPlan(T, { name: uniq('Report plan '), price: 2100 });
const a = await createMember(T, { planId: plan._id });
await createMember(T, { planId: plan._id });
const visit = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: a.member._id }, idem: key() });
check('a member checks in', visit.status === 201 || visit.status === 200, visit.body);
await call('POST', '/admin/leads', { token: desk.token, body: { name: uniq('Lead '), phone: `9${Date.now().toString().slice(-9)}`, source: 'instagram' } });

const after = (await call('GET', '/admin/reports/overview', { token: manager.token })).body;
check('managers can read reports', after.success === true);
check('joins this period go up by two', after.members.joined === before.members.joined + 2, { before: before.members.joined, after: after.members.joined });
check('active members go up by two', after.members.activeNow === before.members.activeNow + 2);
check('12 months of joins for the trend', after.members.joinsByMonth.length === 12 && after.members.joinsByMonth.at(-1).joined >= 2);
const sold = after.plans.sold.find((p) => p.planName === plan.name);
check('plan sales list the new plan with the money collected', sold?.sold === 2 && sold.amount >= 4200, after.plans.sold);
check('current plans list it too', after.plans.current.find((p) => p.planName === plan.name)?.members === 2);
check('the visit is counted', after.attendance.visits === before.attendance.visits + 1 && after.attendance.visitors >= 1);
check('the heatmap is 7 days by 24 hours', after.attendance.heatmap.length === 7 && after.attendance.heatmap.every((d) => d.length === 24));
check('the busiest slot is reported', after.attendance.busiest && after.attendance.busiest.count >= 1);
check('the enquiry is counted by source', after.enquiries.total === before.enquiries.total + 1 && after.enquiries.bySource.some((s) => s.source === 'instagram'));
check('renewals summary has a rate field and 12 months', 'rate' in after.renewals && after.renewals.byMonth.length === 12 && after.renewals.graceDays === 30);
check('the period is echoed back', /^\d{4}-\d{2}-01$/.test(after.period.from) && after.period.days >= 1);

const custom = await call('GET', '/admin/reports/overview?from=2026-01-01&to=2026-01-31', { token: T });
check('a custom period works', custom.status === 200 && custom.body.period.days === 31 && custom.body.period.prevTo === '2025-12-31');
check('a backwards period is a field error', (await call('GET', '/admin/reports/overview?from=2026-02-01&to=2026-01-01', { token: T })).status === 422);
check('more than a year is refused', (await call('GET', '/admin/reports/overview?from=2024-01-01&to=2026-01-31', { token: T })).status === 422);
check('the not-coming-in window is bounded', (await call('GET', '/admin/reports/overview?days=2', { token: T })).status === 422);

const quiet = await call('GET', '/admin/reports/not-coming-in?days=14', { token: T });
check('not-coming-in list answers', quiet.status === 200 && Array.isArray(quiet.body.items) && quiet.body.days === 14);
check('members who just joined aren’t flagged yet', !quiet.body.items.some((m) => m.memberId === String(a.member._id)));

const csv = await call('GET', '/admin/reports/renewals.csv', { token: T, raw: true });
check('renewals export is a spreadsheet', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type')) && csv.text.includes('Outcome'));
const quietCsv = await call('GET', '/admin/reports/not-coming-in.csv?days=30', { token: T, raw: true });
check('not-coming-in export is a spreadsheet', quietCsv.status === 200 && quietCsv.text.includes('Last visit'));

check('front desk cannot read reports (403)', (await call('GET', '/admin/reports/overview', { token: desk.token })).status === 403);
check('trainer cannot read reports (403)', (await call('GET', '/admin/reports/overview', { token: trainer.token })).status === 403);
check('trainer cannot export (403)', (await call('GET', '/admin/reports/renewals.csv', { token: trainer.token })).status === 403);

// Dashboard money rules.
const dTrainer = (await call('GET', '/admin/dashboard', { token: trainer.token })).body;
check('trainer dashboard has no dues or revenue', dTrainer.success && dTrainer.dues === undefined && dTrainer.revenue === undefined, Object.keys(dTrainer));
check('trainer dashboard activity has no payments', dTrainer.activity.every((x) => x.kind !== 'payment'));
const dDesk = (await call('GET', '/admin/dashboard', { token: desk.token })).body;
check('front desk sees dues but not revenue', typeof dDesk.dues?.amount === 'number' && dDesk.revenue === undefined);
const dOwner = (await call('GET', '/admin/dashboard', { token: T })).body;
check('dashboard counts frozen members', typeof dOwner.members.frozen === 'number');

// Freezing a member moves them from active to frozen on the dashboard.
const frozen = await call('POST', `/admin/memberships/${a.sale?.membership?._id || a.sale?.membershipId}/freeze`, { token: T, body: { days: 10, reason: 'Travelling home' }, idem: key() });
if (frozen.status === 201) {
  const dFrozen = (await call('GET', '/admin/dashboard', { token: T })).body;
  check('a frozen member counts as frozen, not active', dFrozen.members.frozen === dOwner.members.frozen + 1 && dFrozen.members.active === dOwner.members.active - 1, dFrozen.members);
  const notLapsed = !dFrozen.lapsed.items.some((m) => String(m.memberId) === String(a.member._id));
  check('a frozen member is never listed as lapsed', notLapsed);
} else {
  check('freeze for the dashboard check', false, frozen.body);
}

finish();
