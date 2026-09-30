// Members & membership lifecycle: registration fields, photos, list filters and export, permissions,
// freeze / unfreeze / extend, plan changes in history, renewals desk, and the member-app API.
import { API, ORIGIN, adminToken, call, check, createMember, createPlan, finish, key, memberToken, staffToken, uniq, uniqPhone } from '../lib.mjs';

const DAY = 86_400_000;
const T = await adminToken();
const manager = await staffToken('manager', T);
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);
const M = manager.token;
const D = desk.token;
const TR = trainer.token;

/** `YYYY-MM-DD` in gym time, `offset` days from today. */
const dayKey = (offset = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * DAY));
/** Start of a gym day as a Date. */
const gymDayStart = (key) => new Date(`${key}T00:00:00+05:30`);
const ms = (d) => new Date(d).getTime();
const detail = async (id, token = T) => (await call('GET', `/admin/members/${id}`, { token })).body;
const settings = (await call('GET', '/admin/settings', { token: T })).body.settings;
const regFee = Number(settings.registrationFee) || 0;

// ── Plans: every length sells for the right number of days; only managers write plans
const plans = {};
for (const [name, body, days] of [
  ['month', { duration: 'month', price: 1500 }, 30],
  ['quarter', { duration: 'quarter', price: 4000 }, 90],
  ['half', { duration: 'half_year', price: 7000 }, 182],
  ['year', { duration: 'year', price: 12000 }, 365],
  ['custom', { duration: 'month', durationInDays: 45, price: 2000 }, 45],
  ['short', { duration: 'week', durationInDays: 5, price: 500 }, 5],
]) {
  plans[name] = await createPlan(M, body);
  if (name === 'short') continue;
  const { sale } = await createMember(T, { planId: plans[name]._id });
  const length = Math.round((ms(sale.membership.endDate) - ms(sale.membership.startDate)) / DAY);
  check(`${name} plan sells for ${days} days`, length === days, length);
}
const hidden = await createPlan(M, { duration: 'month', price: 999, showOnFrontend: false });
const retired = await createPlan(M, { duration: 'month', price: 888, status: 'Inactive' });
check('front desk cannot create plans (403)', (await call('POST', '/plans', { token: D, body: { name: 'X', price: 1, duration: 'day' } })).status === 403);
check('trainer cannot edit plans (403)', (await call('PATCH', `/plans/${plans.month._id}`, { token: TR, body: { price: 1 } })).status === 403);
check('manager can edit plans', (await call('PATCH', `/plans/${plans.custom._id}`, { token: M, body: { description: 'Festival offer' } })).status === 200);

// ── Registration: joining date, referral, validation, permissions
const tag = uniq('Join');
const joinedDay = dayKey(-40);
const reg1 = await call('POST', '/admin/members', {
  token: D,
  idem: key(),
  body: { details: { name: `${tag} Asha`, phone: uniqPhone(), joinedAt: joinedDay, referral: { channel: 'instagram' } }, force: true },
});
check('front desk registers a member with joining date and referral (201)', reg1.status === 201, reg1.body);
const ASHA = reg1.body.member?._id;
check('joining date stored as the start of that gym day', ms(reg1.body.member?.joinedAt) === ms(gymDayStart(joinedDay)), reg1.body.member?.joinedAt);
check('referral channel stored', reg1.body.member?.referral?.channel === 'instagram', reg1.body.member?.referral);

const reg2 = await call('POST', '/admin/members', {
  token: T,
  idem: key(),
  body: { details: { name: `${tag} Bhanu`, phone: uniqPhone(), referral: { referredByMemberId: ASHA } }, force: true },
});
const BHANU = reg2.body.member?._id;
check('referred-by member stored with their name, channel defaults to friend', reg2.body.member?.referral?.referredByName === `${tag} Asha` && reg2.body.member.referral.channel === 'friend', reg2.body.member?.referral);
check('joining date defaults to today', ms(reg2.body.member?.joinedAt) === ms(gymDayStart(dayKey(0))), reg2.body.member?.joinedAt);

const badRef = await call('POST', '/admin/members', {
  token: T,
  idem: key(),
  body: { details: { name: 'Ref Missing', phone: uniqPhone(), referral: { referredByMemberId: '64b7f0c2a1b2c3d4e5f60718' } }, force: true },
});
check('unknown referring member is a field error (422)', badRef.status === 422 && badRef.body.details?.fields?.['details.referral.referredByMemberId'], badRef.body);
const future = await call('POST', '/admin/members', { token: T, idem: key(), body: { details: { name: 'Future', phone: uniqPhone(), joinedAt: dayKey(3) }, force: true } });
check('joining date in the future is refused (422)', future.status === 422 && future.body.details?.fields?.['details.joinedAt'], future.body);
const badEmergency = await call('POST', '/admin/members', { token: T, idem: key(), body: { details: { name: 'EC', phone: uniqPhone(), emergencyContact: { phone: 'call my dad' } }, force: true } });
check('bad emergency phone is a field error (422)', badEmergency.status === 422 && badEmergency.body.details?.fields?.['details.emergencyContact.phone'], badEmergency.body);
check('trainer cannot register members (403)', (await call('POST', '/admin/members', { token: TR, idem: key(), body: { details: { name: 'No', phone: uniqPhone() }, force: true } })).status === 403);

const detailB = await detail(BHANU);
check('profile shows who referred them', detailB.member.referral?.referredBy?.name === `${tag} Asha`, detailB.member.referral);
check('profile has no trainer until one is assigned', detailB.member.assignedTrainer === null, detailB.member.assignedTrainer);

const edit = await call('PATCH', `/admin/members/${BHANU}`, { token: D, body: { details: { joinedAt: dayKey(-10), referral: null } } });
check('editing sets joining date and clears referral', edit.status === 200 && ms(edit.body.member.joinedAt) === ms(gymDayStart(dayKey(-10))) && !edit.body.member.referral?.channel, edit.body.member);
const selfRef = await call('PATCH', `/admin/members/${BHANU}`, { token: D, body: { details: { referral: { referredByMemberId: BHANU } } } });
check('a member cannot refer themselves (422)', selfRef.status === 422, selfRef.body);
check('trainer cannot edit members (403)', (await call('PATCH', `/admin/members/${BHANU}`, { token: TR, body: { details: { name: 'X' } } })).status === 403);

// ── List filters and CSV export
const joinedList = await call('GET', `/admin/members?q=${encodeURIComponent(tag)}&joinedFrom=${dayKey(-45)}&joinedTo=${dayKey(-20)}`, { token: T });
check('joined date range filter', joinedList.status === 200 && joinedList.body.members.length === 1 && joinedList.body.members[0]._id === ASHA, joinedList.body.members?.map((m) => m.name));
const recentList = await call('GET', `/admin/members?q=${encodeURIComponent(tag)}&joinedFrom=${dayKey(-15)}`, { token: T });
check('joined-from alone', recentList.body.members?.length === 1 && recentList.body.members[0]._id === BHANU, recentList.body.members?.map((m) => m.name));
check('reversed date range is a field error (422)', (await call('GET', `/admin/members?joinedFrom=${dayKey(-1)}&joinedTo=${dayKey(-5)}`, { token: T })).status === 422);
const noTrainer = await call('GET', `/admin/members?q=${encodeURIComponent(tag)}&trainerId=none`, { token: T });
check('unassigned-trainer filter', noTrainer.body.members?.length === 2, noTrainer.body.members?.length);
const someTrainer = await call('GET', `/admin/members?q=${encodeURIComponent(tag)}&trainerId=64b7f0c2a1b2c3d4e5f60718`, { token: T });
check('trainer filter excludes members of other trainers', someTrainer.body.members?.length === 0, someTrainer.body.members?.length);

const evil = await call('POST', '/admin/members', { token: T, idem: key(), body: { details: { name: `=HYPERLINK("http://x") ${tag}`, phone: uniqPhone() }, health: { weightKg: 71 }, force: true } });
const csvRes = await fetch(`${API}/admin/members/export.csv?q=${encodeURIComponent(tag)}`, { headers: { Authorization: `Bearer ${T}` } });
const csv = await csvRes.text();
check('export is a CSV download', csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get('content-type')) && /attachment/.test(csvRes.headers.get('content-disposition')), csvRes.status);
check('export has the filtered members', csv.includes(`${tag} Asha`) && csv.includes(`${tag} Bhanu`) && csv.split('\r\n').filter(Boolean).length === 4, csv);
check('export defuses spreadsheet formulas', evil.status === 201 && csv.includes(`'=HYPERLINK`), csv.slice(0, 400));
check('export has no health data', !/weight|height|medical|blood/i.test(csv));
check('owner export includes dues', csv.includes('Dues (INR)'));
const trainerCsv = await fetch(`${API}/admin/members/export.csv?q=${encodeURIComponent(tag)}`, { headers: { Authorization: `Bearer ${TR}` } }).then((r) => r.text());
check('trainer export has no money column', trainerCsv.includes(`${tag} Asha`) && !trainerCsv.includes('Dues'), trainerCsv.slice(0, 300));
check('export with a member token is refused (403)', (await fetch(`${API}/admin/members/export.csv`, { headers: { Authorization: `Bearer ${memberToken(ASHA)}` } })).status === 403);

// ── Trainers see members but never money
const withDues = await createMember(T, { planId: plans.month._id, collect: 'later' });
const trainerList = await call('GET', `/admin/members?q=${encodeURIComponent(withDues.member.name)}`, { token: TR });
check('trainer can list members', trainerList.status === 200 && trainerList.body.members.length === 1);
check('trainer list has no dues', trainerList.body.members[0].dues === undefined && trainerList.body.counts.dues === undefined, trainerList.body.members[0]);
check('trainer cannot filter by dues (403)', (await call('GET', '/admin/members?state=dues', { token: TR })).status === 403);
const trainerDetail = await detail(withDues.member._id, TR);
check('trainer profile view hides payments, dues and prices', trainerDetail.payments.length === 0 && trainerDetail.member.dues === undefined && trainerDetail.memberships.every((m) => m.price === undefined), { p: trainerDetail.payments.length, d: trainerDetail.member.dues });
const ownerDetail = await detail(withDues.member._id);
check('owner profile view keeps payments and dues', ownerDetail.payments.length === (regFee > 0 ? 2 : 1) && ownerDetail.member.dues === 1500 + regFee, { p: ownerDetail.payments.length, d: ownerDetail.member.dues });
check('trainer cannot sell plans (403)', (await call('POST', `/admin/members/${ASHA}/memberships`, { token: TR, idem: key(), body: { planId: plans.month._id, payment: { collect: 'later' } } })).status === 403);
check('trainer cannot open ID proofs (403)', (await call('GET', `/admin/members/${ASHA}/id-proof`, { token: TR })).status === 403);
check('front desk cannot cancel plans (403)', (await call('POST', `/admin/members/${withDues.member._id}/memberships/${withDues.sale.membership._id}/cancel`, { token: D })).status === 403);

// ── Profile photo: camera or file, verified as an image, replaced cleanly
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const photoForm = (bytes, type = 'image/png', field = 'photo') => {
  const fd = new FormData();
  fd.append(field, new Blob([bytes], { type }), 'face.png');
  return fd;
};
// Unknown /uploads paths fall through to the web app's index page, so check for an actual image.
const isImage = async (url) => {
  const r = await fetch(ORIGIN + url);
  return r.status === 200 && /^image\//.test(r.headers.get('content-type') || '');
};
const up1 = await call('POST', `/admin/members/${ASHA}/photo`, { token: D, body: photoForm(PNG) });
check('front desk uploads a profile photo', up1.status === 200 && up1.body.member.profilePhoto.startsWith('/uploads/avatars/'), up1.body);
check('profile photo is served publicly', await isImage(up1.body.member?.profilePhoto));
const up2 = await call('POST', `/admin/members/${ASHA}/photo`, { token: D, body: photoForm(PNG) });
check('replacing the photo removes the old file', up2.status === 200 && (await isImage(up2.body.member.profilePhoto)) && !(await isImage(up1.body.member.profilePhoto)));
const fake = await call('POST', `/admin/members/${ASHA}/photo`, { token: D, body: photoForm(Buffer.from('<script>alert(1)</script> not an image at all'), 'image/png') });
check('a non-image pretending to be a PNG is refused (422)', fake.status === 422 && fake.body.code === 'INVALID_FILE_TYPE', fake.body);
const pdf = await call('POST', `/admin/members/${ASHA}/photo`, { token: D, body: photoForm(Buffer.from('%PDF-1.4'), 'application/pdf') });
check('a PDF is refused as a photo (422)', pdf.status === 422, pdf.body);
check('a file in the wrong form field is refused (400)', (await call('POST', `/admin/members/${ASHA}/photo`, { token: D, body: photoForm(PNG, 'image/png', 'other') })).status === 400);
check('no file at all is a field error (422)', (await call('POST', `/admin/members/${ASHA}/photo`, { token: D, body: new FormData() })).status === 422);
check('trainer cannot change photos (403)', (await call('POST', `/admin/members/${ASHA}/photo`, { token: TR, body: photoForm(PNG) })).status === 403);
const rm = await call('DELETE', `/admin/members/${ASHA}/photo`, { token: D });
check('remove photo', rm.status === 200 && rm.body.member.profilePhoto === '' && !(await isImage(up2.body.member.profilePhoto)));

// ── Freeze / unfreeze / extend
const A = await createMember(T, { planId: plans.month._id });
const AID = A.member._id;
const AM = A.sale.membership._id;
const end0 = ms(A.sale.membership.endDate);
const freezeBody = { days: 10, reason: 'Travelling home for Diwali' };
check('front desk cannot freeze (403)', (await call('POST', `/admin/memberships/${AM}/freeze`, { token: D, idem: key(), body: freezeBody })).status === 403);
check('trainer cannot freeze (403)', (await call('POST', `/admin/memberships/${AM}/freeze`, { token: TR, idem: key(), body: freezeBody })).status === 403);
check('freeze needs an Idempotency-Key (400)', (await call('POST', `/admin/memberships/${AM}/freeze`, { token: M, body: freezeBody })).status === 400);
for (const [label, body, field] of [
  ['past start date', { ...freezeBody, startDate: dayKey(-2) }, 'startDate'],
  ['zero days', { ...freezeBody, days: 0 }, 'days'],
  ['too many days', { ...freezeBody, days: 91 }, 'days'],
  ['no reason', { days: 5 }, 'reason'],
  ['start too far ahead', { ...freezeBody, startDate: dayKey(45) }, 'startDate'],
]) {
  const r = await call('POST', `/admin/memberships/${AM}/freeze`, { token: M, idem: key(), body });
  check(`freeze validation: ${label} (422 on ${field})`, r.status === 422 && r.body.details?.fields?.[field], r.body);
}
const FK = key();
const fr = await call('POST', `/admin/memberships/${AM}/freeze`, { token: M, idem: FK, body: freezeBody });
check('manager freezes from today (201, paused)', fr.status === 201 && fr.body.membership.status === 'paused' && fr.body.membership.freeze?.days === 10, fr.body);
check('freeze moves the end date out by the days booked', ms(fr.body.membership?.endDate) - end0 === 10 * DAY, (ms(fr.body.membership?.endDate) - end0) / DAY);
const frAgain = await call('POST', `/admin/memberships/${AM}/freeze`, { token: M, idem: FK, body: freezeBody });
check('freeze retry replays without freezing twice', frAgain.headers.get('idempotent-replayed') === 'true' && ms((await detail(AID)).member.current.endDate) - end0 === 10 * DAY);
const fr2 = await call('POST', `/admin/memberships/${AM}/freeze`, { token: M, idem: key(), body: { ...freezeBody, days: 3 } });
check('a second freeze is refused (409 ALREADY_FROZEN)', fr2.status === 409 && fr2.body.code === 'ALREADY_FROZEN', fr2.body);
const frozenDetail = await detail(AID);
check('member shows as frozen with the resume date', frozenDetail.member.state === 'paused' && frozenDetail.member.current.freeze?.endDate, frozenDetail.member.state);
const frozenList = await call('GET', `/admin/members?state=paused&q=${encodeURIComponent(A.member.name)}`, { token: T });
check('frozen filter lists the member', frozenList.body.members?.length === 1 && frozenList.body.counts.paused >= 1, frozenList.body.counts);
const checkIn = await call('POST', '/admin/attendance', { token: T, body: { memberId: AID } });
check('a frozen member cannot check in', checkIn.status >= 400 && checkIn.status < 500 && checkIn.body?.success === false, checkIn.body);
const card = await call('GET', '/member/membership/card', { token: A.token });
check('membership card shows the hold', card.status === 200 && card.body.card.resumesOn && card.body.card.state === 'paused', card.body);
const mine = await call('GET', '/member/membership', { token: A.token });
check('member app shows the running freeze', mine.body.state === 'paused' && mine.body.membership.freeze?.running === true, mine.body);

check('front desk cannot unfreeze (403)', (await call('POST', `/admin/memberships/${AM}/unfreeze`, { token: D })).status === 403);
const uf = await call('POST', `/admin/memberships/${AM}/unfreeze`, { token: M, idem: key() });
check('unfreeze the same day gives every day back', uf.status === 200 && uf.body.daysFrozen === 0 && uf.body.daysGivenBack === 10 && uf.body.membership.status === 'active' && ms(uf.body.membership.endDate) === end0, uf.body);
const uf2 = await call('POST', `/admin/memberships/${AM}/unfreeze`, { token: M });
check('unfreezing a plan that isn’t frozen (409 NOT_FROZEN)', uf2.status === 409 && uf2.body.code === 'NOT_FROZEN');

// Booked ahead: starts tomorrow, runs its course via the daily roll-over.
const ahead = await call('POST', `/admin/memberships/${AM}/freeze`, { token: M, idem: key(), body: { startDate: dayKey(1), days: 5, reason: 'Knee surgery' } });
check('a freeze booked for tomorrow keeps the plan active today', ahead.status === 201 && ahead.body.membership.status === 'active' && ms(ahead.body.membership.endDate) - end0 === 5 * DAY, ahead.body.membership);
const noon = (offset) => new Date(ms(gymDayStart(dayKey(offset))) + 12 * 3600_000).toISOString();
const s1 = await call('POST', '/admin/memberships/_test/settle', { token: M, body: { now: noon(2) } });
check('roll-over starts the booked freeze on its day', s1.status === 200 && (await detail(AID)).member.state === 'paused', s1.body);
const s2 = await call('POST', '/admin/memberships/_test/settle', { token: M, body: { now: noon(7) } });
const afterRun = await detail(AID);
check('roll-over resumes the plan when the freeze ends', s2.body.resumed >= 1 && afterRun.member.state !== 'paused' && !afterRun.memberships.find((m) => m._id === AM).freeze, s2.body);
check('a freeze that ran its course keeps the moved end date', ms(afterRun.memberships.find((m) => m._id === AM).endDate) - end0 === 5 * DAY && afterRun.memberships.find((m) => m._id === AM).frozenDays === 5);
const s3 = await call('POST', '/admin/memberships/_test/settle', { token: M, body: { now: noon(8) } });
check('roll-over is idempotent', s3.body.resumed === 0 && s3.body.paused === 0, s3.body);

// Queued renewals move with the plan in front of them.
const B = await createMember(T, { planId: plans.month._id });
const renewB = await call('POST', `/admin/members/${B.member._id}/memberships`, { token: T, idem: key(), body: { planId: plans.month._id, payment: { collect: 'now', mode: 'cash' } } });
const up0 = renewB.body.sale.membership;
await call('POST', `/admin/memberships/${B.sale.membership._id}/freeze`, { token: M, idem: key(), body: { days: 7, reason: 'Exams' } });
const upAfter = (await detail(B.member._id)).memberships.find((m) => m._id === up0._id);
check('freezing moves the queued renewal by the same days', ms(upAfter.startDate) - ms(up0.startDate) === 7 * DAY && ms(upAfter.endDate) - ms(up0.endDate) === 7 * DAY, { s: (ms(upAfter.startDate) - ms(up0.startDate)) / DAY });
await call('POST', `/admin/memberships/${B.sale.membership._id}/unfreeze`, { token: M, idem: key() });
const upBack = (await detail(B.member._id)).memberships.find((m) => m._id === up0._id);
check('unfreezing moves the queued renewal back', ms(upBack.startDate) === ms(up0.startDate));
check('an upcoming plan cannot be frozen (409)', (await call('POST', `/admin/memberships/${up0._id}/freeze`, { token: M, idem: key(), body: { days: 2, reason: 'Sick' } })).body.code === 'NOT_FREEZABLE');

// Selling while frozen: switching today is refused, renewing after the plan works.
const F = await createMember(T, { planId: plans.month._id });
const ff = await call('POST', `/admin/memberships/${F.sale.membership._id}/freeze`, { token: M, idem: key(), body: { days: 4, reason: 'Fever' } });
const switchToday = await call('POST', `/admin/members/${F.member._id}/memberships`, { token: D, idem: key(), body: { planId: plans.quarter._id, start: 'today', payment: { collect: 'later' } } });
check('switching plans today while frozen is refused (409 PLAN_FROZEN)', switchToday.status === 409 && switchToday.body.code === 'PLAN_FROZEN', switchToday.body);
const renewFrozen = await call('POST', `/admin/members/${F.member._id}/memberships`, { token: D, idem: key(), body: { planId: plans.month._id, payment: { collect: 'later' } } });
check('renewing a frozen plan queues after its moved end date', renewFrozen.status === 201 && renewFrozen.body.sale.membership.status === 'upcoming' && ms(renewFrozen.body.sale.membership.startDate) === ms(ff.body.membership.endDate), renewFrozen.body.sale?.membership);

// Extend
const beforeExt = ms((await detail(AID)).member.current.endDate);
check('front desk cannot extend (403)', (await call('POST', `/admin/memberships/${AM}/extend`, { token: D, idem: key(), body: { days: 3, reason: 'AC broken' } })).status === 403);
const extBad = await call('POST', `/admin/memberships/${AM}/extend`, { token: M, idem: key(), body: { days: 0, reason: 'x' } });
check('extend validation (422)', extBad.status === 422 && extBad.body.details?.fields?.days && extBad.body.details.fields.reason, extBad.body);
const EK = key();
const ext = await call('POST', `/admin/memberships/${AM}/extend`, { token: M, idem: EK, body: { days: 3, reason: 'Gym closed for repairs' } });
check('manager adds complimentary days', ext.status === 201 && ms(ext.body.membership.endDate) - beforeExt === 3 * DAY && ext.body.membership.bonusDays === 3, ext.body);
const extAgain = await call('POST', `/admin/memberships/${AM}/extend`, { token: M, idem: EK, body: { days: 3, reason: 'Gym closed for repairs' } });
check('extend retry does not add days twice', extAgain.headers.get('idempotent-replayed') === 'true' && ms((await detail(AID)).member.current.endDate) - beforeExt === 3 * DAY);
check('extend an unknown membership (404)', (await call('POST', '/admin/memberships/64b7f0c2a1b2c3d4e5f60718/extend', { token: M, idem: key(), body: { days: 3, reason: 'Test run' } })).status === 404);

// Plan changes appear in history with the right type.
const C = await createMember(T, { planId: plans.month._id });
const up = await call('POST', `/admin/members/${C.member._id}/memberships`, { token: D, idem: key(), body: { planId: plans.quarter._id, start: 'today', payment: { collect: 'now', mode: 'upi' } } });
check('switching to a dearer plan today is an upgrade', up.status === 201 && up.body.sale.changeType === 'upgrade', up.body.sale?.changeType);
const down = await call('POST', `/admin/members/${C.member._id}/memberships`, { token: D, idem: key(), body: { planId: plans.month._id, payment: { collect: 'later' } } });
check('queuing a cheaper plan is a downgrade', down.status === 201 && down.body.sale.changeType === 'downgrade' && down.body.sale.membership.status === 'upcoming', down.body.sale?.changeType);
const same = await call('POST', `/admin/members/${B.member._id}/memberships`, { token: D, idem: key(), body: { planId: plans.month._id, payment: { collect: 'later' } } });
check('another plan while one is queued is refused (409)', same.status === 409 && same.body.code === 'RENEWAL_EXISTS');

const cancelA = await call('POST', `/admin/members/${AID}/memberships/${AM}/cancel`, { token: M, body: { reason: 'Moved to another city' } });
check('manager cancels a plan', cancelA.status === 200 && cancelA.body.membership.status === 'cancelled', cancelA.body);
check('extending a cancelled plan is refused (409)', (await call('POST', `/admin/memberships/${AM}/extend`, { token: M, idem: key(), body: { days: 3, reason: 'Late request' } })).body.code === 'NOT_EXTENDABLE');

const tl = await call('GET', `/admin/members/${AID}/timeline`, { token: T });
const types = tl.body.items?.map((e) => e.type) || [];
check('timeline has join, freezes, unfreezes, extension and cancellation', ['join', 'freeze', 'unfreeze', 'extend', 'cancel'].every((t) => types.includes(t)) && types[0] === 'cancel', types);
const autoResume = tl.body.items?.find((e) => e.type === 'unfreeze' && e.source === 'system');
check('automatic resume is recorded with the days frozen', autoResume?.days === 5 && autoResume.by === 'Automatic', autoResume);
const freezeEvent = tl.body.items?.find((e) => e.type === 'freeze');
check('staff see who froze it and why', freezeEvent?.by === 'Test manager' && freezeEvent.note, freezeEvent);
const joinEvent = tl.body.items?.find((e) => e.type === 'join');
check('owner timeline shows the amount', joinEvent?.amount === 1500, joinEvent);
const tlTrainer = await call('GET', `/admin/members/${AID}/timeline`, { token: TR });
check('trainer timeline has no amounts', tlTrainer.status === 200 && tlTrainer.body.items.every((e) => e.amount === undefined));
const tlC = (await call('GET', `/admin/members/${C.member._id}/timeline`, { token: T })).body.items.map((e) => e.type);
check('timeline records upgrade and downgrade', tlC.includes('upgrade') && tlC.includes('downgrade'), tlC);

// ── Renewals desk
const soon = await createMember(T, { planId: plans.short._id });
const soonQueued = await createMember(T, { planId: plans.short._id });
await call('POST', `/admin/members/${soonQueued.member._id}/memberships`, { token: D, idem: key(), body: { planId: plans.month._id, payment: { collect: 'later' } } });
const ending7 = await call('GET', '/admin/memberships/ending?within=7&limit=100', { token: D });
const endingIds = ending7.body.items?.map((i) => i.member._id) || [];
check('ending soon lists a plan ending in 5 days', ending7.status === 200 && endingIds.includes(soon.member._id), ending7.body);
check('members who already renewed are left out', !endingIds.includes(soonQueued.member._id));
const soonRow = ending7.body.items?.find((i) => i.member._id === soon.member._id);
check('ending row has days left, plan and phone', soonRow?.daysLeft === 5 && soonRow.membership.planName && soonRow.member.phone, soonRow);
check('ending counts grow with the window', ending7.body.counts[7] <= ending7.body.counts[15] && ending7.body.counts[15] <= ending7.body.counts[30], ending7.body.counts);
const ending30 = await call('GET', '/admin/memberships/ending?within=30&limit=100', { token: D });
check('30-day window includes monthly plans', ending30.body.items.some((i) => i.member._id === withDues.member._id));
check('trainer cannot open renewals (403)', (await call('GET', '/admin/memberships/ending', { token: TR })).status === 403);

const lapsed = await call('GET', '/admin/memberships/lapsed?since=30&limit=100', { token: D });
check('a cancelled plan that ran shows as lapsed', lapsed.status === 200 && lapsed.body.items.some((i) => i.member._id === AID && i.membership.status === 'cancelled'), lapsed.body.items?.length);
check('members with a current plan are not lapsed', !lapsed.body.items.some((i) => i.member._id === C.member._id));

const hist = await call('GET', '/admin/memberships/renewal-history?since=1&limit=100', { token: D });
const upRow = hist.body.items?.find((i) => i.member._id === C.member._id && i.type === 'upgrade');
check('renewal history shows plan changes with amount and who', upRow?.amount === 4000 && upRow.by === 'Test staff' && upRow.fromPlanName === plans.month.name, upRow);
check('renewal history can be filtered by type', (await call('GET', '/admin/memberships/renewal-history?type=downgrade&since=1', { token: D })).body.items.every((i) => i.type === 'downgrade'));

// ── Member app API
const E = await createMember(T, {});
const ET = E.token;
const none = await call('GET', '/member/membership', { token: ET });
check('member without a plan: state none, can request', none.status === 200 && none.body.state === 'none' && none.body.membership === null && none.body.canRequestPlan === true, none.body);
const plansRes = await call('GET', '/member/membership/plans', { token: ET });
const planIds = plansRes.body.plans?.map((p) => p.id) || [];
check('buyable plans: active and shown on the website only', planIds.includes(plans.month._id) && !planIds.includes(hidden._id) && !planIds.includes(retired._id), planIds.length);
check('first plan carries the registration fee', plansRes.body.isFirstPlan === true && plansRes.body.registrationFee === regFee);
check('request needs an Idempotency-Key (400)', (await call('POST', '/member/membership/requests', { token: ET, body: { planId: plans.month._id } })).status === 400);
check('request for a hidden plan is refused (404)', (await call('POST', '/member/membership/requests', { token: ET, idem: key(), body: { planId: hidden._id } })).status === 404);
check('request validates the plan id (422)', (await call('POST', '/member/membership/requests', { token: ET, idem: key(), body: { planId: 'nope' } })).status === 422);
const RK = key();
const req1 = await call('POST', '/member/membership/requests', { token: ET, idem: RK, body: { planId: plans.month._id } });
check('member requests a plan: pending, priced by the server', req1.status === 201 && req1.body.request.status === 'pending' && req1.body.request.amountDue === 1500 + regFee && req1.body.request.changeType === 'join', req1.body);
const req1b = await call('POST', '/member/membership/requests', { token: ET, idem: RK, body: { planId: plans.month._id } });
check('request retry replays', req1b.headers.get('idempotent-replayed') === 'true' && req1b.body.request.id === req1.body.request.id);
const req2 = await call('POST', '/member/membership/requests', { token: ET, idem: key(), body: { planId: plans.quarter._id } });
check('second request while one waits (409 PENDING_PAYMENT)', req2.status === 409 && req2.body.code === 'PENDING_PAYMENT', req2.body);
const waiting = await call('GET', '/member/membership', { token: ET });
check('member sees the request and its dues', waiting.body.state === 'pending' && waiting.body.dues.amount === 1500 + regFee && waiting.body.canRequestPlan === false, waiting.body);
check('another member cannot withdraw it (404)', (await call('POST', `/member/membership/requests/${req1.body.request.id}/cancel`, { token: A.token })).status === 404);
const withdraw = await call('POST', `/member/membership/requests/${req1.body.request.id}/cancel`, { token: ET });
check('member withdraws the request', withdraw.status === 200 && (await call('GET', '/member/membership', { token: ET })).body.state === 'none');
check('a withdrawn request is not a lapsed plan', !(await call('GET', '/admin/memberships/lapsed?since=30&limit=100', { token: D })).body.items.some((i) => i.member._id === E.member._id));

const req3 = await call('POST', '/member/membership/requests', { token: ET, idem: key(), body: { planId: plans.month._id } });
check('after withdrawing, the next request is still a first join', req3.status === 201 && req3.body.request.changeType === 'join' && req3.body.request.amountDue === 1500 + regFee, req3.body.request);
for (const d of req3.body.dues) await call('POST', `/admin/payments/${d.id}/collect`, { token: D, idem: key(), body: { mode: 'cash' } });
const active = await call('GET', '/member/membership', { token: ET });
check('paying the dues starts the plan', active.body.state === 'active' && active.body.membership.daysLeft === 30 && active.body.dues.amount === 0, active.body);
const renewReq = await call('POST', '/member/membership/requests', { token: ET, idem: key(), body: { planId: plans.month._id } });
check('renewal request starts after the current plan', renewReq.status === 201 && renewReq.body.request.changeType === 'renew' && ms(renewReq.body.request.startsAfter) === ms(active.body.membership.endDate) && renewReq.body.request.amountDue === 1500, renewReq.body.request);
for (const d of renewReq.body.dues) await call('POST', `/admin/payments/${d.id}/collect`, { token: D, idem: key(), body: { mode: 'upi' } });
const renewed = await call('GET', '/member/membership', { token: ET });
check('paid renewal is queued after the current plan', renewed.body.next?.status === 'upcoming' && ms(renewed.body.next.startDate) === ms(active.body.membership.endDate), renewed.body.next);
const myHist = await call('GET', '/member/membership/history', { token: ET });
check('member history: events without staff notes', myHist.status === 200 && myHist.body.events.some((e) => e.type === 'renew') && myHist.body.events.every((e) => e.note === undefined && e.by === undefined), myHist.body.events?.map((e) => e.type));
check('member history leaves out withdrawn requests', myHist.body.memberships.length === 2, myHist.body.memberships.length);
const myCard = await call('GET', '/member/membership/card', { token: ET });
check('membership card data', myCard.status === 200 && myCard.body.card.name === E.member.name && myCard.body.card.memberCode && myCard.body.card.planName === plans.month.name && myCard.body.card.gym.name, myCard.body.card);
check('member API needs a member token (401/403)', [401, 403].includes((await call('GET', '/member/membership', { token: T })).status));

finish();
