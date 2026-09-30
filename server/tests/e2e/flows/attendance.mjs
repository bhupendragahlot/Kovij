// Attendance & QR: desk check-in/out, QR scans at the desk and kiosk, the desk log, day/month
// views, CSV export, member history, member app endpoints, permissions and idempotency.
import { adminToken, call, check, createMember, createPlan, finish, key, memberToken, staffToken, uniq } from '../lib.mjs';

const T = await adminToken();
const trainer = await staffToken('trainer', T);
const desk = await staffToken('staff', T);
const plan = await createPlan(T, { name: uniq('Attendance plan ') });

const { member: priya } = await createMember(T, { planId: plan._id, name: uniq('Priya ') });
const { member: kabir } = await createMember(T, { planId: plan._id, name: uniq('Kabir ') });
const { member: neha } = await createMember(T, { name: uniq('Neha ') }); // no plan
const PRIYA = priya._id;
const KABIR = kabir._id;
const NEHA = neha._id;
const today = (await call('GET', '/admin/attendance', { token: T })).body.date;
const month = today.slice(0, 7);

// ── Desk check-in with an idempotency key
const K1 = key();
const in1 = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: PRIYA }, idem: K1 });
check('desk check-in (201) records method and who', in1.status === 201 && in1.body.attendance.method === 'desk' && in1.body.attendance.recordedBy === desk.user.id, in1.body);
const in1b = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: PRIYA }, idem: K1 });
check('check-in retry with the same key is replayed', in1b.status === 201 && in1b.headers.get('idempotent-replayed') === 'true' && in1b.body.attendance._id === in1.body.attendance._id);
const in1c = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: PRIYA } });
check('second check-in without a key returns the open visit', in1c.status === 200 && in1c.body.alreadyCheckedIn === true);
const VISIT = in1.body.attendance._id;

// ── Check-out, undo check-out, come back
const out1 = await call('POST', `/admin/attendance/${VISIT}/check-out`, { token: desk.token, body: {}, idem: key() });
check('check-out records time, method and who', out1.status === 200 && out1.body.attendance.checkedOutAt && out1.body.attendance.checkOutMethod === 'desk' && out1.body.alreadyCheckedOut === false, out1.body);
const out1b = await call('POST', `/admin/attendance/${VISIT}/check-out`, { token: desk.token, body: {}, idem: key() });
check('second check-out keeps the first time', out1b.status === 200 && out1b.body.alreadyCheckedOut === true && out1b.body.attendance.checkedOutAt === out1.body.attendance.checkedOutAt);
check('check-out needs an Idempotency-Key (400)', (await call('POST', `/admin/attendance/${VISIT}/check-out`, { token: desk.token, body: {} })).status === 400);
const undoOut = await call('DELETE', `/admin/attendance/${VISIT}/check-out`, { token: desk.token });
check('undo check-out puts the member back in the gym', undoOut.status === 200 && undoOut.body.attendance.checkedOutAt === null, undoOut.body);
check('undo check-out twice is a 409', (await call('DELETE', `/admin/attendance/${VISIT}/check-out`, { token: desk.token })).status === 409);
await call('POST', `/admin/attendance/${VISIT}/check-out`, { token: desk.token, body: {}, idem: key() });
const back = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: PRIYA } });
check('checking in after a check-out reopens the same visit', back.status === 200 && back.body.returned === true && back.body.attendance._id === VISIT && back.body.attendance.entries === 2, back.body);

// ── Desk override needs a reason; refusals are logged
const refused = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: NEHA } });
check('no plan: refused with reason and canOverride at the desk', refused.status === 409 && refused.body.code === 'MEMBERSHIP_INACTIVE' && refused.body.details.reason === 'No plan' && refused.body.details.canOverride === true, refused.body);
check('override without reason is 422 on the field', (await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: NEHA, override: true } })).body?.details?.fields?.overrideReason);
const letIn = await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: NEHA, override: true, overrideReason: 'Paying tomorrow' } });
check('let in once with a reason', letIn.status === 201 && letIn.body.attendance.overrideReason === 'Paying tomorrow' && letIn.body.attendance.membershipStatus === 'none', letIn.body);

// ── QR codes
const qr = await call('GET', `/admin/attendance/members/${KABIR}/qr`, { token: desk.token });
check('desk can fetch a member QR code', qr.status === 200 && /^KV1\./.test(qr.body.token) && qr.body.version === 1 && qr.body.memberCode === kabir.memberCode, qr.body);
const mineQr = await call('GET', '/member/attendance/qr', { token: memberToken(KABIR) });
check('member app gets the same code plus member code fallback', mineQr.status === 200 && mineQr.body.token === qr.body.token && mineQr.body.memberCode === kabir.memberCode, mineQr.body);
const TOKEN = qr.body.token;

const scan = (body, token = desk.token, idem = key()) => call('POST', '/admin/attendance/scan', { token, body, idem });
const s1 = await scan({ code: TOKEN, source: 'kiosk' });
check('kiosk scan checks in (method kiosk, no phone on the shared screen)', s1.status === 201 && s1.body.action === 'checked_in' && s1.body.attendance.method === 'kiosk' && s1.body.member.phone === undefined, s1.body);
const s2 = await scan({ code: TOKEN, source: 'kiosk' });
check('immediate second scan does not check out', s2.status === 200 && s2.body.action === 'already_in', s2.body);
const s3 = await scan({ code: TOKEN, source: 'kiosk', mode: 'out' });
check('scan in check-out mode checks out', s3.body.action === 'checked_out' && s3.body.attendance.checkOutMethod === 'kiosk', s3.body);
check('scan in check-out mode again: already out', (await scan({ code: TOKEN, source: 'kiosk', mode: 'out' })).body.action === 'already_out');
const s5 = await scan({ code: TOKEN, source: 'kiosk' });
check('scan after checking out: returned', s5.body.action === 'returned' && s5.body.attendance.entries === 2, s5.body);
const KS = key();
const s6 = await scan({ code: TOKEN, source: 'desk' }, desk.token, KS);
const s6b = await scan({ code: TOKEN, source: 'desk' }, desk.token, KS);
check('scan retry with the same key is replayed, not repeated', s6b.headers.get('idempotent-replayed') === 'true' && s6b.body.action === s6.body.action);
check('scan needs an Idempotency-Key (400)', (await call('POST', '/admin/attendance/scan', { token: desk.token, body: { code: TOKEN } })).status === 400);

// Tampered, foreign and typed codes
const tampered = TOKEN.slice(0, -1) + (TOKEN.endsWith('A') ? 'B' : 'A');
check('tampered QR code is refused (404 QR_UNKNOWN)', (await scan({ code: tampered, source: 'kiosk' })).body.code === 'QR_UNKNOWN');
check('a website QR is not a member code', (await scan({ code: 'https://example.com/menu', source: 'desk' })).body.code === 'QR_UNKNOWN');
check('kiosk never accepts a typed member code', (await scan({ code: kabir.memberCode, source: 'kiosk' })).body.code === 'QR_UNKNOWN');
const typed = await scan({ code: kabir.memberCode.toLowerCase(), source: 'desk', mode: 'in' });
check('desk accepts a typed member code (any case)', typed.status === 200 && typed.body.member._id === KABIR && typed.body.attendance.method !== undefined, typed.body);
check('unknown member code is 404', (await scan({ code: 'KFZ-999999', source: 'desk' })).body.code === 'MEMBER_CODE_UNKNOWN');

// Refusals at the kiosk can't be overridden
const nehaQr = (await call('GET', `/admin/attendance/members/${NEHA}/qr`, { token: T })).body.token;
await call('DELETE', `/admin/attendance/${letIn.body.attendance._id}`, { token: desk.token });
const kioskNo = await scan({ code: nehaQr, source: 'kiosk', override: true, overrideReason: 'please' });
check('kiosk refuses a member without a plan, with no override', kioskNo.status === 409 && kioskNo.body.details.canOverride === false && kioskNo.body.details.reason === 'No plan', kioskNo.body);
const deskNo = await scan({ code: nehaQr, source: 'desk' });
check('desk scan of the same member offers the override', deskNo.status === 409 && deskNo.body.details.canOverride === true);
check('scan in check-out mode for someone not in: 409', (await scan({ code: nehaQr, source: 'kiosk', mode: 'out' })).body.code === 'NOT_CHECKED_IN');

// Replace a lost code
const re = await call('POST', `/admin/attendance/members/${KABIR}/qr/reissue`, { token: desk.token, body: { reason: 'Card lost' }, idem: key() });
check('replace QR code bumps the version', re.status === 201 && re.body.version === 2 && re.body.token !== TOKEN, re.body);
const old = await scan({ code: TOKEN, source: 'kiosk' });
check('old code stops working (410 QR_REVOKED, no member details at the kiosk)', old.status === 410 && old.body.code === 'QR_REVOKED' && !old.body.details, old.body);
check('old code at the desk names the member', (await scan({ code: TOKEN, source: 'desk' })).body.details?.member?._id === KABIR);
check('new code works', (await scan({ code: re.body.token, source: 'kiosk', mode: 'in' })).status === 200);
const re2 = await call('POST', `/admin/attendance/members/${KABIR}/qr/reissue`, { token: T, body: {}, idem: key() });
check('replacing again moves on to version 3', re2.body.version === 3 && (await call('GET', '/member/attendance/qr', { token: memberToken(KABIR) })).body.token === re2.body.token);

// ── Validation
check('scan with empty code is 422 on the field', (await scan({ code: '  ' })).body?.details?.fields?.code);
check('check-in with a bad member id is 422', (await call('POST', '/admin/attendance', { token: T, body: { memberId: 'nope' } })).status === 422);
check('impossible date is 422', (await call('GET', '/admin/attendance?date=2026-02-30', { token: T })).status === 422);
check('bad month is 422', (await call('GET', '/admin/attendance/month?month=2026-13', { token: T })).status === 422);
check('scan mode must be known', (await scan({ code: TOKEN, mode: 'sideways' })).status === 422);
check('check-out of an unknown visit is 404', (await call('POST', '/admin/attendance/64b7f0c2a1b2c3d4e5f60718/check-out', { token: T, body: {}, idem: key() })).status === 404);

// ── Day view and desk log
const day = await call('GET', '/admin/attendance', { token: T });
const pRow = day.body.items.find((i) => i.memberId._id === PRIYA);
check('day view lists visits with status, who and how', pRow && pRow.status === 'in' && pRow.recordedBy?.name === 'Test staff' && pRow.method === 'desk', pRow);
check('day view has 24 hours with a typical line', day.body.byHour.length === 24 && day.body.byHour.every((h) => 'typical' in h));
check('day summary counts visits and methods', day.body.summary.visits >= 2 && day.body.summary.byMethod.kiosk >= 1, day.body.summary);
const types = new Set(day.body.events.filter((e) => [PRIYA, KABIR, NEHA].includes(e.member?._id)).map((e) => e.type));
for (const t of ['check_in', 'check_out', 'undo_check_out', 'returned', 'refused', 'undo_check_in', 'qr_reissued']) check(`desk log has ${t}`, types.has(t), [...types]);
const refusedOld = day.body.events.filter((e) => e.type === 'refused' && e.reason === 'Old QR code' && e.member?._id === KABIR);
check('old QR code refusals are logged with how they were scanned', refusedOld.some((e) => e.method === 'kiosk') && refusedOld.some((e) => e.method === 'qr'), refusedOld);
const filtered = await call('GET', `/admin/attendance?memberId=${KABIR}`, { token: T });
check('day view filters by member', filtered.body.items.length === 1 && filtered.body.items[0].memberId._id === KABIR && filtered.body.events.every((e) => e.member?._id === KABIR));

// ── Month view, per-member counts, CSV export
const mv = await call('GET', `/admin/attendance/month?month=${month}`, { token: trainer.token });
const todayRow = mv.body.days?.find((d) => d.date === today);
check('month view: every day, today counted', mv.status === 200 && mv.body.days.length >= 28 && todayRow.visits >= 2 && mv.body.totals.members >= 2, mv.body.totals);
const mm = await call('GET', `/admin/attendance/month/members?month=${month}&q=${encodeURIComponent(priya.name)}`, { token: T });
check('month members: search and count', mm.status === 200 && mm.body.total === 1 && mm.body.items[0].visits === 1 && mm.body.items[0].member.name === priya.name, mm.body);
const csv = await call('GET', `/admin/attendance/export?month=${month}`, { token: T, raw: true });
check('CSV export for the owner', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type')) && csv.text.includes(kabir.memberCode) && csv.text.includes('Checked in'), csv.text?.slice(0, 200));
const csvM = await call('GET', `/admin/attendance/export?month=${month}&kind=members`, { token: T, raw: true });
check('member totals CSV', csvM.status === 200 && csvM.text.includes('Visits') && csvM.text.includes(priya.name));

// ── Member history (staff) and the member app
const sum = await call('GET', `/admin/attendance/members/${PRIYA}/summary`, { token: trainer.token });
check('member summary: last 30 days, streak, 12-month trend', sum.status === 200 && sum.body.last30Days === 1 && sum.body.streak.current === 1 && sum.body.trend.length === 12, sum.body);
const hist = await call('GET', `/admin/attendance/members/${PRIYA}/history?limit=5`, { token: T });
check('member history (staff) includes who recorded it', hist.body.total === 1 && hist.body.items[0].recordedBy?.name === 'Test staff');
const cal = await call('GET', `/admin/attendance/members/${PRIYA}/month?month=${month}`, { token: T });
check('member month calendar marks today', cal.body.daysVisited === 1 && cal.body.days.find((d) => d.date === today)?.visit);
check('member summary for an unknown member is 404', (await call('GET', '/admin/attendance/members/64b7f0c2a1b2c3d4e5f60718/summary', { token: T })).status === 404);

const MT = memberToken(PRIYA);
const mToday = await call('GET', '/member/attendance/today', { token: MT });
check('member app: today', mToday.status === 200 && mToday.body.success && mToday.body.status === 'in' && mToday.body.visit.entries === 2, mToday.body);
const mHist = await call('GET', '/member/attendance/history?page=1&limit=10', { token: MT });
check('member app: history is paginated and hides staff details', mHist.body.total === 1 && mHist.body.page === 1 && mHist.body.items[0].recordedBy === undefined && mHist.body.items[0].overrideReason === undefined, mHist.body);
const mMonth = await call('GET', `/member/attendance/month?month=${month}`, { token: MT });
check('member app: month summary', mMonth.body.daysVisited === 1 && mMonth.body.days.some((d) => d.visit), mMonth.body.daysVisited);
const mStreak = await call('GET', '/member/attendance/streak', { token: MT });
check('member app: streak', mStreak.body.current === 1 && mStreak.body.last30Days === 1, mStreak.body);
check('member app: needs a member token', (await call('GET', '/member/attendance/today')).status === 401 && (await call('GET', '/member/attendance/today', { token: T })).status === 401);
check('member app: bad month is 422', (await call('GET', '/member/attendance/month?month=2026-00', { token: MT })).status === 422);

// ── Permissions
check('trainer can view the day', (await call('GET', '/admin/attendance', { token: trainer.token })).status === 200);
for (const [label, method, path, body] of [
  ['check in', 'POST', '/admin/attendance', { memberId: PRIYA }],
  ['scan', 'POST', '/admin/attendance/scan', { code: TOKEN }],
  ['check out', 'POST', `/admin/attendance/${VISIT}/check-out`, {}],
  ['undo check-out', 'DELETE', `/admin/attendance/${VISIT}/check-out`],
  ['undo check-in', 'DELETE', `/admin/attendance/${VISIT}`],
  ['see a QR code', 'GET', `/admin/attendance/members/${PRIYA}/qr`],
  ['replace a QR code', 'POST', `/admin/attendance/members/${PRIYA}/qr/reissue`, {}],
  ['export CSV', 'GET', `/admin/attendance/export?month=${month}`],
]) {
  check(`trainer cannot ${label} (403)`, (await call(method, path, { token: trainer.token, body, idem: key() })).status === 403);
}
check('front desk cannot export CSV (403)', (await call('GET', `/admin/attendance/export?month=${month}`, { token: desk.token })).status === 403);
check('no token is 401', (await call('GET', '/admin/attendance')).status === 401);

// ── Undo check-in (today) removes the visit but keeps the log
const undo = await call('DELETE', `/admin/attendance/${VISIT}`, { token: desk.token });
check('undo check-in', undo.status === 200 && (await call('GET', '/member/attendance/today', { token: MT })).body.status === 'not_in');
check('undo again is 404', (await call('DELETE', `/admin/attendance/${VISIT}`, { token: desk.token })).status === 404);

finish();
