// ExerciseDB: search, assign to members, the member's schedule and ticking off, and staff monitoring.
// ExerciseDB itself is the local stand-in from exerciseDbStub.mjs (E2E_EXERCISEDB_STUB).
import { adminToken, call, check, createMember, finish, key, staffToken, uniq } from '../lib.mjs';

const STUB = process.env.E2E_EXERCISEDB_STUB;
const stub = (path) => fetch(`${STUB}${path}`, { method: path.startsWith('/__calls') ? 'GET' : 'POST' }).then((r) => r.json());
await stub('/__reset');

const T = await adminToken();
const trainer = await staffToken('trainer', T);
const unlinked = await staffToken('trainer', T);
const desk = await staffToken('staff', T);
const manager = await staffToken('manager', T);
const TR = trainer.token;

const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftDay = (dayKey, days) => new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const tomorrow = shiftDay(todayKey, 1);

// ── Access ─────────────────────────────────────────────────────────────────
check('ExerciseDB search needs a staff session (401)', (await call('GET', '/admin/exercisedb/exercises')).status === 401);
for (const path of ['/admin/exercisedb/exercises', '/admin/exercisedb/filters', '/admin/exercise-assignments']) {
  const r = await call('GET', path, { token: desk.token });
  check(`front desk cannot open ${path} (403)`, r.status === 403, r.status);
}
check('member library needs a member session (401)', (await call('GET', '/member/exercises/library', { token: TR })).status === 401);

// ── Searching ExerciseDB through the server ────────────────────────────────
const filters = await call('GET', '/admin/exercisedb/filters', { token: TR });
check(
  'filters list body parts, muscles and equipment; no types on the free host',
  filters.status === 200 && filters.body.bodyParts.includes('chest') && filters.body.targetMuscles.includes('pectorals') && filters.body.equipments.includes('barbell') && filters.body.exerciseTypes.length === 0 && filters.body.unavailable === false,
  filters.body
);
const bench = await call('GET', '/admin/exercisedb/exercises?q=bench%20press', { token: TR });
check('search by name: full matches first, ExerciseDB shape normalised', bench.status === 200 && bench.body.items[0].name === 'Barbell bench press' && bench.body.items[0].gifUrl.startsWith('https://') && bench.body.items[0].primaryMuscle === 'chest', bench.body.items?.map((i) => i.name));
check('lists leave out instructions', bench.body.items.every((i) => i.instructions === undefined));
const chestDb = await call('GET', '/admin/exercisedb/exercises?bodyPart=chest&equipment=dumbbell', { token: TR });
check('filter by body part + equipment', chestDb.status === 200 && chestDb.body.items.length === 1 && chestDb.body.items[0].id === 'SpYC0Kp', chestDb.body);
const byMuscle = await call('GET', '/admin/exercisedb/exercises?muscle=glutes', { token: TR });
check('filter by target muscle', byMuscle.body.items.length === 2 && byMuscle.body.items.every((i) => i.targetMuscles.includes('glutes')), byMuscle.body);
const page1 = await call('GET', '/admin/exercisedb/exercises?limit=3', { token: TR });
const page2 = await call('GET', `/admin/exercisedb/exercises?limit=3&after=${page1.body.nextCursor}`, { token: TR });
check('cursor paging', page1.body.total === 8 && page1.body.items.length === 3 && page2.body.items.length === 3 && page2.body.items[0].id !== page1.body.items[0].id, [page1.body.nextCursor, page2.body.items?.map((i) => i.id)]);
const detail = await call('GET', '/admin/exercisedb/exercises/EIeI8Vf', { token: TR });
check('detail has clean instructions and media', detail.status === 200 && detail.body.exercise.instructions[0] === 'Set up for the barbell bench press.' && detail.body.exercise.secondaryMuscles.includes('triceps'), detail.body);
const missing = await call('GET', '/admin/exercisedb/exercises/doesNotExist1', { token: TR });
check('unknown ExerciseDB id is a 404', missing.status === 404 && missing.body.code === 'EXERCISE_NOT_FOUND', missing.body);
const badQuery = await call('GET', '/admin/exercisedb/exercises?q=%3Cscript%3E', { token: TR });
check('odd characters in a search are refused (422)', badQuery.status === 422, badQuery.body);

const callsBefore = await stub('/__calls');
await call('GET', '/admin/exercisedb/exercises?q=bench%20press', { token: T });
const callsAfter = await stub('/__calls');
check('a repeated search is served from the cache', callsAfter['/api/v1/exercises'] === callsBefore['/api/v1/exercises'], [callsBefore, callsAfter]);

// ExerciseDB busy (429): a clear message, and cached answers keep working.
await stub('/__busy?n=1&retry=1');
const busy = await call('GET', '/admin/exercisedb/exercises?q=curl', { token: TR });
check('ExerciseDB rate limit becomes "busy, try again" (503)', busy.status === 503 && busy.body.code === 'EXERCISEDB_BUSY' && /Try again in 1 seconds?/.test(busy.body.message) && busy.body.details.retryAfter === 1, busy.body);
const cachedWhileBusy = await call('GET', '/admin/exercisedb/exercises?q=bench%20press', { token: TR });
check('cached searches still answer while ExerciseDB is busy', cachedWhileBusy.status === 200, cachedWhileBusy.status);
await new Promise((r) => setTimeout(r, 1200));
check('after the cool-down the search works again', (await call('GET', '/admin/exercisedb/exercises?q=curl', { token: TR })).status === 200);

// ── Setup: a trainer with one member, and a member who isn't theirs ────────
const trainerProfile = await call('POST', '/admin/trainers', { token: T, body: { name: uniq('Coach Asha '), role: 'Strength coach', userId: trainer.user.id }, idem: key() });
check('trainer profile linked to the login (201)', trainerProfile.status === 201, trainerProfile.body);
const TID = trainerProfile.body.trainer._id;
const A = await createMember(T, { name: uniq('Kiran ') });
const B = await createMember(T, { name: uniq('Meera ') });
const AID = A.member._id;
const BID = B.member._id;
await call('POST', `/admin/trainers/${TID}/members`, { token: T, body: { memberIds: [AID] } });

// ── Assigning ──────────────────────────────────────────────────────────────
const assignBody = {
  date: todayKey,
  repeatWeeks: 2,
  items: [
    { exerciseDbId: 'EIeI8Vf', name: 'Spoofed name', sets: 4, reps: '8-10', restSec: 90, weightKg: 40, notes: 'Pause on the chest' },
    { exerciseDbId: 'rjiM4L3', durationSec: 600 },
  ],
};
const noKey = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: TR, body: assignBody });
check('assigning needs an Idempotency-Key (400)', noKey.status === 400 && noKey.body.code === 'IDEMPOTENCY_KEY_REQUIRED', noKey.body);
const notMine = await call('POST', `/admin/exercise-assignments/members/${BID}`, { token: TR, body: assignBody, idem: key() });
check("trainer cannot assign to another trainer's member (403)", notMine.status === 403 && notMine.body.code === 'NOT_YOUR_MEMBER' && notMine.body.message.includes(B.member.name), notMine.body);
const noProfile = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: unlinked.token, body: assignBody, idem: key() });
check('trainer login without a profile is told why (403)', noProfile.status === 403 && noProfile.body.code === 'TRAINER_NOT_LINKED', noProfile.body);
const past = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: TR, body: { ...assignBody, date: shiftDay(todayKey, -1) }, idem: key() });
check('a past day is refused (422)', past.status === 422 && past.body.details.fields.date, past.body);
const nothing = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: TR, body: { date: todayKey, items: [{ exerciseDbId: 'EIeI8Vf' }] }, idem: key() });
check('each exercise needs sets or a time (422)', nothing.status === 422 && nothing.body.details.fields['items.0.sets'], nothing.body);
const ghost = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: TR, body: { date: todayKey, items: [{ exerciseDbId: 'doesNotExist1', sets: 3, reps: '10' }] }, idem: key() });
check('an exercise ExerciseDB does not have is refused (422)', ghost.status === 422 && ghost.body.code === 'EXERCISE_NOT_FOUND', ghost.body);

const idem = key();
const assigned = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: TR, body: assignBody, idem });
const rows = assigned.body?.assignments || [];
check('trainer assigns 2 exercises, repeated for 2 weeks (201, 4 rows)', assigned.status === 201 && rows.length === 4, assigned.body);
check('names come from ExerciseDB, not the browser', rows[0]?.exercise.name === 'Barbell bench press' && rows[0].exercise.exerciseDbId === 'EIeI8Vf' && rows[0].exercise.primaryMuscle === 'chest', rows[0]);
check('prescription saved; repeat lands a week later', rows[0]?.sets === 4 && rows[0].reps === '8-10' && rows[0].weightKg === 40 && rows[1].durationSec === 600 && rows[2].dayKey === shiftDay(todayKey, 7), rows.map((r) => r.dayKey));
check('the snapshot keeps no media links (they rotate weekly)', rows.every((r) => !('gifUrl' in r.exercise)));
const retried = await call('POST', `/admin/exercise-assignments/members/${AID}`, { token: TR, body: assignBody, idem });
check('a retried assign does not add copies', [200, 201].includes(retried.status) && retried.body.assignments.length === 4 && retried.body.assignments[0]._id === rows[0]._id, retried.status);
const mgrAssign = await call('POST', `/admin/exercise-assignments/members/${BID}`, { token: manager.token, body: { date: tomorrow, items: [{ exerciseDbId: 'qXTaZnJ', sets: 5, reps: '5' }], notify: false }, idem: key() });
check('manager assigns to any member (201)', mgrAssign.status === 201 && mgrAssign.body.assignments.length === 1, mgrAssign.body);

// ── The member's schedule ──────────────────────────────────────────────────
const sched = await call('GET', '/member/exercises/schedule', { token: A.token });
const s = sched.body;
check('today has both exercises, in order, still to do', sched.status === 200 && s.today.length === 2 && s.today[0].exercise.name === 'Barbell bench press' && s.today.every((x) => x.state === 'today'), s);
check('next week’s copies are under upcoming', s.upcoming.length === 2 && s.upcoming.every((x) => x.dayKey === shiftDay(todayKey, 7)) && s.counts.upcoming === 2, s.upcoming);
check('week tally: 2 to do, 0 done', s.counts.week === 2 && s.counts.weekDone === 0, s.counts);
check('member copy has no staff-only fields', !('trainerId' in s.today[0]) && !('cancelledAt' in s.today[0]));
const inbox = await call('GET', '/member/notifications', { token: A.token });
const notice = inbox.body?.items?.find((n) => n.kind === 'workout' && /2 exercises from Coach Asha/.test(n.title));
check('member is told about the new exercises', Boolean(notice) && notice.body.includes('Barbell bench press') && notice.link === '/member/workouts?tab=schedule', inbox.body?.items?.map((n) => n.title));
const libraryAsMember = await call('GET', '/member/exercises/library?q=squat', { token: A.token });
check('members can search ExerciseDB too', libraryAsMember.status === 200 && libraryAsMember.body.items.length === 2, libraryAsMember.body);
const detailAsMember = await call('GET', '/member/exercises/library/EIeI8Vf', { token: A.token });
check('members can open an exercise', detailAsMember.status === 200 && detailAsMember.body.exercise.instructions.length === 3);

// ── Ticking off ────────────────────────────────────────────────────────────
const [first, second] = s.today;
const done = await call('POST', `/member/exercises/${first._id}/complete`, { token: A.token, body: {} });
check('member marks an exercise done', done.status === 200 && done.body.assignment.status === 'completed' && done.body.assignment.state === 'done' && done.body.assignment.completedBy === 'member', done.body);
const doneAgain = await call('POST', `/member/exercises/${first._id}/complete`, { token: A.token, body: {} });
check('marking it done again is harmless', doneAgain.status === 200 && doneAgain.body.assignment.completedAt === done.body.assignment.completedAt);
const otherMember = await call('POST', `/member/exercises/${first._id}/complete`, { token: B.token, body: {} });
check("another member can't touch it (404)", otherMember.status === 404, otherMember.status);
const early = await call('POST', `/member/exercises/${s.upcoming[0]._id}/complete`, { token: A.token, body: {} });
check('next week’s exercise cannot be ticked off yet (409)', early.status === 409 && early.body.code === 'NOT_DUE_YET', early.body);
const undo = await call('POST', `/member/exercises/${first._id}/reopen`, { token: A.token });
check('member can undo a mistaken tap', undo.status === 200 && undo.body.assignment.status === 'assigned' && !undo.body.assignment.completedAt, undo.body);
const withNote = await call('POST', `/member/exercises/${first._id}/complete`, { token: A.token, body: { memberNote: 'Felt strong, last set hard' } });
check('done with a note', withNote.status === 200 && withNote.body.assignment.memberNote === 'Felt strong, last set hard', withNote.body);
const history = await call('GET', '/member/exercises/history', { token: A.token });
check('history lists what was done', history.status === 200 && history.body.total === 1 && history.body.items[0]._id === first._id, history.body);

// ── Trainer and owner see it ───────────────────────────────────────────────
const asTrainer = await call('GET', `/admin/exercise-assignments/members/${AID}`, { token: TR });
check('trainer sees the member’s schedule with today’s done item', asTrainer.status === 200 && asTrainer.body.canManage === true && asTrainer.body.today.find((x) => x._id === first._id)?.state === 'done' && asTrainer.body.counts.weekDone === 1, asTrainer.body);
const otherAsTrainer = await call('GET', `/admin/exercise-assignments/members/${BID}`, { token: TR });
check("another trainer's member is read-only for this trainer", otherAsTrainer.status === 200 && otherAsTrainer.body.canManage === false && otherAsTrainer.body.thisWeek.length + otherAsTrainer.body.upcoming.length + otherAsTrainer.body.today.length >= 1);
const staffHistory = await call('GET', `/admin/exercise-assignments/members/${AID}/history?status=done`, { token: T });
check('owner sees the history with the member’s note', staffHistory.status === 200 && staffHistory.body.items[0].memberNote === 'Felt strong, last set hard', staffHistory.body);

const range = `from=${todayKey}&to=${shiftDay(todayKey, 7)}`;
const ownerView = await call('GET', `/admin/exercise-assignments?${range}`, { token: T });
const ov = ownerView.body;
const rowsForUs = ov.items?.filter((i) => [AID, BID].includes(i.memberId)) || [];
check('owner overview lists both members with names', ownerView.status === 200 && rowsForUs.length === 5 && rowsForUs.some((i) => i.member?.name === A.member.name) && rowsForUs.some((i) => i.member?.name === B.member.name), ov);
const trainerRow = ov.byTrainer?.find((r) => r.trainer?._id === TID);
check('per-trainer breakdown: 4 assigned, 1 done, 100% of what was due', trainerRow?.total === 4 && trainerRow.done === 1 && trainerRow.missed === 0 && trainerRow.completionRate === 100 && trainerRow.members === 1, trainerRow);
const trainerView = await call('GET', `/admin/exercise-assignments?${range}`, { token: TR });
check('trainer overview shows only their members, no trainer breakdown', trainerView.status === 200 && trainerView.body.items.every((i) => i.memberId === AID) && trainerView.body.summary.total === 4 && trainerView.body.byTrainer.length === 0, trainerView.body.summary);
const doneOnly = await call('GET', `/admin/exercise-assignments?${range}&status=done&memberId=${AID}`, { token: T });
check('filter: done, one member', doneOnly.body.items.length === 1 && doneOnly.body.items[0]._id === first._id, doneOnly.body.items?.length);
const badRange = await call('GET', `/admin/exercise-assignments?from=${tomorrow}&to=${todayKey}`, { token: T });
check('a backwards date range is refused (422)', badRange.status === 422, badRange.body);
const unlinkedView = await call('GET', '/admin/exercise-assignments', { token: unlinked.token });
check('unlinked trainer sees an explained empty list', unlinkedView.status === 200 && unlinkedView.body.linked === false && unlinkedView.body.items.length === 0);

// ── Changing and removing ──────────────────────────────────────────────────
const moved = await call('PATCH', `/admin/exercise-assignments/${second._id}`, { token: TR, body: { date: tomorrow, durationSec: 900, notes: 'Easy pace' } });
check('trainer moves an exercise to tomorrow and changes the time', moved.status === 200 && moved.body.assignment.dayKey === tomorrow && moved.body.assignment.durationSec === 900 && moved.body.assignment.notes === 'Easy pace', moved.body);
const editDone = await call('PATCH', `/admin/exercise-assignments/${first._id}`, { token: TR, body: { sets: 5 } });
check('a done exercise cannot be edited (409)', editDone.status === 409 && editDone.body.code === 'NOT_EDITABLE', editDone.body);
const editOther = await call('PATCH', `/admin/exercise-assignments/${mgrAssign.body.assignments[0]._id}`, { token: TR, body: { sets: 3 } });
check("trainer cannot edit another trainer's member's exercise (403)", editOther.status === 403, editOther.body);
const cancelled = await call('POST', `/admin/exercise-assignments/${s.upcoming[1]._id}/cancel`, { token: TR });
check('trainer removes an exercise (kept as cancelled)', cancelled.status === 200 && cancelled.body.assignment.status === 'cancelled', cancelled.body);
const cancelDone = await call('POST', `/admin/exercise-assignments/${first._id}/cancel`, { token: TR });
check('a done exercise cannot be removed (409)', cancelDone.status === 409, cancelDone.body);
const after = (await call('GET', '/member/exercises/schedule', { token: A.token })).body;
// (On a Sunday "tomorrow" is next week, so the moved one may also be under upcoming.)
check('member no longer sees the removed one; the moved one is tomorrow', after.upcoming.filter((x) => x._id !== second._id).length === 1 &&!after.today.some((x) => x._id === second._id) && [...after.thisWeek, ...after.upcoming].some((x) => x._id === second._id && x.dayKey === tomorrow), after);
const staffTick = await call('POST', `/admin/exercise-assignments/${mgrAssign.body.assignments[0]._id}/complete`, { token: manager.token, body: {} });
check('staff cannot tick off tomorrow’s exercise either (409)', staffTick.status === 409 && staffTick.body.code === 'NOT_DUE_YET', staffTick.body);

// ── Activity log ───────────────────────────────────────────────────────────
let logged;
for (let i = 0; i < 10 && !logged; i += 1) {
  const r = await call('GET', `/admin/activity?memberId=${AID}`, { token: T });
  logged = r.body?.items?.find((e) => e.action === 'exercise.assign');
  if (!logged) await new Promise((res) => setTimeout(res, 200));
}
check('assigning is in the activity log with the member’s name', Boolean(logged) && logged.summary.includes(`scheduled exercises for ${A.member.name}`), logged);

finish();
