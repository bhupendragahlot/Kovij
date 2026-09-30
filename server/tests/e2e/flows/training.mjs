// Trainers, exercise library, workout plans, assignments, sessions and the member workout API.
import { adminToken, call, check, createMember, createPlan, finish, key, staffToken, uniq } from '../lib.mjs';

const T = await adminToken();
const trainer = await staffToken('trainer', T);
const trainer2 = await staffToken('trainer', T);
const desk = await staffToken('staff', T);
const manager = await staffToken('manager', T);
const TR = trainer.token;
const DESK = desk.token;
const MGR = manager.token;

const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const shiftDay = (dayKey, days) => new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// ── Access: no token, member token, front desk ─────────────────────────────
check('workouts need a staff session (401)', (await call('GET', '/admin/workouts')).status === 401);
for (const path of ['/admin/workouts', '/admin/exercises', '/admin/workouts/members']) {
  const r = await call('GET', path, { token: DESK });
  check(`front desk cannot open ${path} (403)`, r.status === 403, r.status);
}
check('front desk cannot create a trainer (403)', (await call('POST', '/admin/trainers', { token: DESK, body: { name: 'X', role: 'Coach' } })).status === 403);
check('trainer role cannot create a trainer (403)', (await call('POST', '/admin/trainers', { token: TR, body: { name: 'X', role: 'Coach' } })).status === 403);

// ── Exercise library (seeded on first read, idempotently) ──────────────────
const lib1 = await call('GET', '/admin/exercises?limit=200', { token: TR });
check('trainer reads the library, built-ins seeded', lib1.status === 200 && lib1.body.total >= 60 && lib1.body.items.every((e) => !e.archived), { s: lib1.status, t: lib1.body?.total });
const lib2 = await call('GET', '/admin/exercises?limit=200', { token: T });
check('reading again does not add duplicates', lib2.body.total === lib1.body.total, [lib1.body.total, lib2.body.total]);
const byName = (name) => lib1.body.items.find((e) => e.name === name);
const BENCH = byName('Barbell bench press');
const SQUAT = byName('Barbell back squat');
const PUSHUP = byName('Push-up');
const PLANK = byName('Plank');
check('built-ins carry instructions and are marked built in', BENCH?.builtIn === true && BENCH.instructions.length > 20 && SQUAT && PUSHUP && PLANK);
const chest = await call('GET', '/admin/exercises?muscle=chest', { token: TR });
check('filter by muscle', chest.body.items.length > 3 && chest.body.items.every((e) => e.primaryMuscle === 'chest' || e.secondaryMuscles.includes('chest')));
const dumbbells = await call('GET', '/admin/exercises?equipment=dumbbell&q=curl', { token: TR });
check('search + equipment filter', dumbbells.body.items.length >= 2 && dumbbells.body.items.every((e) => e.equipment === 'dumbbell' && /curl/i.test(e.name)), dumbbells.body.items?.map((e) => e.name));

const customName = uniq('Sled push ');
const custom = await call('POST', '/admin/exercises', { token: TR, body: { name: customName, primaryMuscle: 'quads', secondaryMuscles: ['glutes'], equipment: 'other', category: 'strength', instructions: 'Push the sled 20 m.', videoUrl: 'https://youtu.be/example' } });
check('trainer adds a custom exercise (201)', custom.status === 201 && custom.body.exercise.builtIn === false, custom.body);
const dupEx = await call('POST', '/admin/exercises', { token: TR, body: { name: `  ${customName.toUpperCase()} `, primaryMuscle: 'quads', equipment: 'other' } });
check('same exercise name is refused (409)', dupEx.status === 409 && dupEx.body.code === 'EXERCISE_EXISTS', dupEx.body);
const badEx = await call('POST', '/admin/exercises', { token: TR, body: { name: uniq('X'), equipment: 'rocket', videoUrl: 'javascript:alert(1)' } });
check('exercise validation names each field (422)', badEx.status === 422 && badEx.body.details.fields.primaryMuscle && badEx.body.details.fields.equipment && badEx.body.details.fields.videoUrl, badEx.body);
const unused = await call('POST', '/admin/exercises', { token: TR, body: { name: uniq('Unused move '), primaryMuscle: 'core', equipment: 'bodyweight' } });
const delUnused = await call('DELETE', `/admin/exercises/${unused.body.exercise._id}`, { token: TR });
check('unused custom exercise is deleted', delUnused.status === 200 && delUnused.body.deleted === true, delUnused.body);

// ── Trainer profiles, schedule and login link ──────────────────────────────
const schedule = [
  { day: 1, shifts: [{ start: '06:00', end: '11:00' }, { start: '16:00', end: '21:00' }] },
  { day: 2, shifts: [{ start: '06:00', end: '11:00' }] },
];
const badSched = await call('POST', '/admin/trainers', { token: T, body: { name: 'Bad', role: 'Coach', schedule: [{ day: 1, shifts: [{ start: '11:00', end: '06:00' }] }] } });
check('shift ending before it starts is refused (422)', badSched.status === 422 && badSched.body.details.fields['schedule.0.shifts.0.end'], badSched.body);
const notTrainerLogin = await call('POST', '/admin/trainers', { token: T, body: { name: 'Bad', role: 'Coach', userId: desk.user.id } });
check('only a trainer-role login can be linked (422)', notTrainerLogin.status === 422 && notTrainerLogin.body.details.fields.userId, notTrainerLogin.body);

const trainerName = uniq('Coach Ravi ');
const created = await call('POST', '/admin/trainers', {
  token: T,
  body: { name: trainerName, role: 'Strength coach', phone: '+91 98765-11111', email: `${uniq('t')}@kovij.test`, specialties: ['Powerlifting'], schedule, userId: trainer.user.id },
  idem: key(),
});
check('admin creates a trainer with schedule and login (201)', created.status === 201 && created.body.trainer.user?.id === trainer.user.id && created.body.trainer.phone === '9876511111', created.body);
check('schedule summary for the desk', created.body.trainer.scheduleText === 'Mon 6 am–11 am, 4 pm–9 pm · Tue 6 am–11 am', created.body.trainer.scheduleText);
const TID = created.body.trainer._id;
const second = await call('POST', '/admin/trainers', { token: MGR, body: { name: uniq('Coach Neha '), role: 'Yoga coach', shift: 'Evenings' } });
check('manager creates a trainer (201)', second.status === 201, second.body);
const T2ID = second.body.trainer._id;
const linkedTwice = await call('PATCH', `/admin/trainers/${T2ID}`, { token: MGR, body: { userId: trainer.user.id } });
check('a login links to one trainer only (409)', linkedTwice.status === 409 && linkedTwice.body.code === 'LOGIN_ALREADY_LINKED', linkedTwice.body);
const logins = await call('GET', '/admin/trainers/logins', { token: MGR });
const loginRow = logins.body.users?.find((u) => u.id === trainer.user.id);
check('trainer logins list shows the link', logins.status === 200 && loginRow?.linkedTrainer?.id === TID && logins.body.users.every((u) => u.id !== desk.user.id), logins.body);
check('trainer role cannot list logins (403)', (await call('GET', '/admin/trainers/logins', { token: TR })).status === 403);
const fallback = await call('GET', '/admin/trainers', { token: DESK });
const t2row = fallback.body.trainers?.find((t) => t._id === T2ID);
check('front desk sees trainers; old shift text is the fallback', fallback.status === 200 && t2row?.scheduleText === 'Evenings', t2row);

const pub = await call('GET', '/trainers');
const pubRow = pub.body.trainers.find((t) => t._id === TID);
check('public trainer list hides phone, email, schedule and login', pubRow && !('phone' in pubRow) && !('email' in pubRow) && !('schedule' in pubRow) && !('userId' in pubRow), pubRow);
const pubOne = await call('GET', `/trainers/${TID}`);
check('public trainer profile hides contact', pubOne.status === 200 && pubOne.body.phone === undefined && pubOne.body.name === trainerName);

const me = await call('GET', '/admin/trainers/me', { token: TR });
check('trainer finds their own profile', me.body.trainer?._id === TID, me.body);
check('unlinked login has no profile', (await call('GET', '/admin/trainers/me', { token: trainer2.token })).body.trainer === null);

const patched = await call('PATCH', `/admin/trainers/${TID}`, { token: MGR, body: { description: 'Former state-level lifter', image: '' } });
check('manager edits a trainer, other fields kept', patched.status === 200 && patched.body.trainer.description === 'Former state-level lifter' && patched.body.trainer.schedule.length === 2, patched.body);
const badLink = await call('PATCH', `/admin/trainers/${TID}`, { token: MGR, body: { instagram: 'javascript:alert(1)' } });
check('unsafe links are refused (422)', badLink.status === 422 && badLink.body.details.fields.instagram, badLink.body);

// ── Members assigned to a trainer ──────────────────────────────────────────
const plan = await createPlan(T, { price: 1200 });
const A = await createMember(T, { planId: plan._id, name: uniq('Asha ') });
const B = await createMember(T, { planId: plan._id, name: uniq('Bharat ') });
const C = await createMember(T, { name: uniq('Chetan ') });
const AID = A.member._id;
const BID = B.member._id;
const CID = C.member._id;

check('trainer role cannot assign members (403)', (await call('POST', `/admin/trainers/${TID}/members`, { token: TR, body: { memberIds: [AID] } })).status === 403);
check('front desk cannot assign members (403)', (await call('POST', `/admin/trainers/${TID}/members`, { token: DESK, body: { memberIds: [AID] } })).status === 403);
const assignEmpty = await call('POST', `/admin/trainers/${TID}/members`, { token: MGR, body: { memberIds: [] } });
check('assigning nobody is a field error (422)', assignEmpty.status === 422 && assignEmpty.body.details.fields.memberIds, assignEmpty.body);
const assigned = await call('POST', `/admin/trainers/${TID}/members`, { token: MGR, body: { memberIds: [AID, BID, AID] } });
check('manager assigns members in bulk', assigned.status === 200 && assigned.body.assigned === 2, assigned.body);
const moved = await call('POST', `/admin/trainers/${T2ID}/members`, { token: MGR, body: { memberIds: [CID] } });
check('another trainer gets their own member', moved.status === 200 && moved.body.moved === 0);

const mine = await call('GET', '/admin/workouts/members?who=mine', { token: TR });
check('"My members" lists only the trainer\'s members', mine.status === 200 && mine.body.linked === true && mine.body.total === 2 && mine.body.items.every((m) => [AID, BID].includes(m._id)), mine.body);
check('roster rows carry membership state and trainer', mine.body.items.every((m) => m.state === 'active' && m.trainer?._id === TID && m.workout === null));
const notLinked = await call('GET', '/admin/workouts/members?who=mine', { token: trainer2.token });
check('unlinked trainer gets an explained empty list', notLinked.status === 200 && notLinked.body.linked === false && notLinked.body.total === 0, notLinked.body);
const noTrainer = await call('GET', `/admin/workouts/members?who=none&q=${encodeURIComponent(C.member.name)}`, { token: T });
check('"No trainer" filter excludes assigned members', noTrainer.body.total === 0);
const trMembers = await call('GET', `/admin/trainers/${TID}/members`, { token: DESK });
check('front desk can see who a trainer coaches', trMembers.status === 200 && trMembers.body.total === 2, trMembers.body);

const unassign = await call('DELETE', `/admin/trainers/${TID}/members/${BID}`, { token: MGR });
check('unassign a member', unassign.status === 200);
const unassignAgain = await call('DELETE', `/admin/trainers/${TID}/members/${BID}`, { token: MGR });
check('unassigning twice explains (404 NOT_ASSIGNED)', unassignAgain.status === 404 && unassignAgain.body.code === 'NOT_ASSIGNED', unassignAgain.body);
await call('POST', `/admin/trainers/${TID}/members`, { token: MGR, body: { memberIds: [BID] } });
const blockedDelete = await call('DELETE', `/admin/trainers/${TID}`, { token: MGR });
check('trainer with members cannot be deleted (409)', blockedDelete.status === 409 && blockedDelete.body.code === 'TRAINER_HAS_MEMBERS', blockedDelete.body);

// ── Workout plan templates ─────────────────────────────────────────────────
const noDays = await call('POST', '/admin/workouts', { token: TR, body: { name: 'Empty', days: [] } });
check('a plan needs at least one day (422)', noDays.status === 422 && noDays.body.details.fields.days, noDays.body);
const ghost = await call('POST', '/admin/workouts', { token: TR, body: { name: 'Ghost', days: [{ name: 'Day 1', exercises: [{ exerciseId: '64f000000000000000000abc', sets: 3, reps: '10' }] }] } });
check('unknown exercise is named in the error (422)', ghost.status === 422 && ghost.body.details.fields['days.0.exercises.0.exerciseId'], ghost.body);

const planName = uniq('Beginner full body ');
const planBody = {
  name: planName,
  goal: 'muscle_gain',
  level: 'beginner',
  daysPerWeek: 3,
  notes: 'Warm up 5 minutes first.',
  days: [
    { name: 'Day 1 – Push', exercises: [{ exerciseId: BENCH._id, sets: 3, reps: '8-12', weightKg: 40, restSec: 90 }, { exerciseId: PUSHUP._id, sets: 2, reps: '15' }] },
    { name: 'Day 2 – Legs', exercises: [{ exerciseId: SQUAT._id, sets: 4, reps: '6-8', weightKg: 60, restSec: 120 }, { exerciseId: custom.body.exercise._id, sets: 3, reps: '20 m' }] },
    { name: 'Day 3 – Core', exercises: [{ exerciseId: PLANK._id, sets: 3, reps: '45 sec', restSec: 30 }] },
  ],
};
const P = await call('POST', '/admin/workouts', { token: TR, body: planBody, idem: key() });
check('trainer creates a 3-day plan (201)', P.status === 201 && P.body.plan.days.length === 3 && P.body.plan.days[0].exercises[0].exercise.name === 'Barbell bench press', P.body);
const PID = P.body.plan._id;
check('exercise order is kept', P.body.plan.days[1].exercises.map((e) => e.order).join() === '0,1');
const list = await call('GET', `/admin/workouts?q=${encodeURIComponent(planName)}`, { token: TR });
check('plan list shows day and exercise counts', list.body.items[0]?.dayCount === 3 && list.body.items[0].exerciseCount === 5 && list.body.items[0].activeMembers === 0, list.body.items?.[0]);
const dup = await call('POST', `/admin/workouts/${PID}/duplicate`, { token: TR, idem: key() });
check('duplicate a plan', dup.status === 201 && dup.body.plan.name === `${planName} (copy)` && dup.body.plan.days.length === 3, dup.body);

// ── Give the plan to members (idempotent) ──────────────────────────────────
check('assigning needs an Idempotency-Key (400)', (await call('POST', `/admin/workouts/${PID}/assign`, { token: TR, body: { memberIds: [AID] } })).status === 400);
const badDate = await call('POST', `/admin/workouts/${PID}/assign`, { token: TR, body: { memberIds: [AID], startDate: '2026-02-31' }, idem: key() });
check('impossible start date is refused (422)', badDate.status === 422 && badDate.body.details.fields.startDate, badDate.body);
const K = key();
// Started yesterday, so yesterday's session (logged by the trainer below) belongs to this plan.
const assign = { memberIds: [AID, BID], startDate: shiftDay(todayKey, -1) };
const g1 = await call('POST', `/admin/workouts/${PID}/assign`, { token: TR, body: assign, idem: K });
check('trainer gives the plan to two members (201)', g1.status === 201 && g1.body.assignments.length === 2 && g1.body.assignments.every((a) => !a.replaced), g1.body);
const g2 = await call('POST', `/admin/workouts/${PID}/assign`, { token: TR, body: assign, idem: K });
check('retry replays, no second copy', g2.headers.get('idempotent-replayed') === 'true' && g2.body.assignments[0].assignmentId === g1.body.assignments[0].assignmentId);
const ovA = await call('GET', `/admin/workouts/members/${AID}`, { token: TR });
check('member overview shows the current plan and today', ovA.status === 200 && ovA.body.current?.name === planName && ovA.body.today?.dayIndex === 0 && ovA.body.history.length === 0, ovA.body);
const ASSIGN_A = ovA.body.current._id;

// Editing the template later must not change what the member is doing.
const editDays = structuredClone(planBody.days);
editDays[0].exercises[0].sets = 5;
const edited = await call('PATCH', `/admin/workouts/${PID}`, { token: TR, body: { days: editDays } });
check('template edited', edited.status === 200 && edited.body.plan.days[0].exercises[0].sets === 5 && edited.body.plan.activeMembers === 2, edited.body.plan?.activeMembers);

// ── Member app: plan, today, logging (idempotent per day) ──────────────────
const mPlan = await call('GET', '/member/workouts', { token: A.token });
const mDay = mPlan.body.plan?.days?.[0];
check('member sees their plan snapshot (sets unchanged by template edit)', mPlan.status === 200 && mDay?.exercises[0].sets === 3 && mDay.exercises[0].name === 'Barbell bench press' && mDay.exercises[0].instructions.length > 20, mDay?.exercises?.[0]);
check('member plan hides internal fields', mPlan.body.plan && !('idempotencyKey' in mPlan.body.plan) && !('assignedBy' in mPlan.body.plan));
check('today suggests day 1', mPlan.body.today?.dayIndex === 0 && mPlan.body.today.doneToday === false && mPlan.body.today.day.name === 'Day 1 – Push', mPlan.body.today);
check('member without a plan gets plan: null', (await call('GET', '/member/workouts', { token: C.token })).body.plan === null);

const session = {
  dayIndex: 0,
  entries: [
    { exerciseId: BENCH._id, sets: [{ reps: 10, weightKg: 40 }, { reps: 8, weightKg: 45 }, { reps: 6, weightKg: 45, done: false }] },
    { exerciseId: PUSHUP._id, sets: [{ reps: 15, weightKg: 0 }] },
  ],
  notes: 'Felt good',
};
const l1 = await call('POST', '/member/workouts/logs', { token: A.token, body: session });
check('member logs today (201)', l1.status === 201 && l1.body.created === true && l1.body.log.volumeKg === 760 && l1.body.log.setsDone === 3 && l1.body.log.dayName === 'Day 1 – Push', l1.body);
const l2 = await call('POST', '/member/workouts/logs', { token: A.token, body: session });
check('saving the same session again updates it (200, same id)', l2.status === 200 && l2.body.created === false && l2.body.log._id === l1.body.log._id, l2.body);
const [c1, c2] = await Promise.all([
  call('POST', '/member/workouts/logs', { token: B.token, body: session }),
  call('POST', '/member/workouts/logs', { token: B.token, body: session }),
]);
check('two saves at once still make one session', [c1.status, c2.status].every((s) => s === 200 || s === 201) && c1.body.log._id === c2.body.log._id, [c1.status, c2.status, c1.body, c2.body]);

const future = await call('POST', '/member/workouts/logs', { token: A.token, body: { ...session, date: shiftDay(todayKey, 2) } });
check('future date is refused (422)', future.status === 422 && future.body.details.fields.date, future.body);
const tooOld = await call('POST', '/member/workouts/logs', { token: A.token, body: { ...session, date: shiftDay(todayKey, -30) } });
check('members can log only the last 7 days (422)', tooOld.status === 422 && tooOld.body.details.fields.date, tooOld.body);
const badDay = await call('POST', '/member/workouts/logs', { token: A.token, body: { ...session, dayIndex: 5 } });
check('plan day must exist (422)', badDay.status === 422 && badDay.body.details.fields.dayIndex, badDay.body);
const nothing = await call('POST', '/member/workouts/logs', { token: A.token, body: { entries: [{ exerciseId: BENCH._id, sets: [{ reps: 5, done: false }] }] } });
check('a session needs a finished set (422)', nothing.status === 422, nothing.body);

const mToday = await call('GET', '/member/workouts/today', { token: A.token });
check('today shows done with the saved session', mToday.body.today?.doneToday === true && mToday.body.today.log?._id === l1.body.log._id && mToday.body.planName === planName, mToday.body);
const mLogs = await call('GET', '/member/workouts/logs?limit=5', { token: A.token });
check('member history is paginated', mLogs.status === 200 && mLogs.body.total === 1 && mLogs.body.limit === 5 && !('loggedByUserId' in mLogs.body.items[0]), mLogs.body);
check('member can read their own session', (await call('GET', `/member/workouts/logs/${l1.body.log._id}`, { token: A.token })).status === 200);
check("member cannot read someone else's session (404)", (await call('GET', `/member/workouts/logs/${l1.body.log._id}`, { token: C.token })).status === 404);
const mProg = await call('GET', '/member/workouts/progress', { token: A.token });
const benchRow = mProg.body.exercises?.find((e) => e.exerciseId === BENCH._id);
check('progress lists logged exercises with best set', benchRow?.best.weightKg === 45 && benchRow.best.reps === 8 && benchRow.best.e1rm === 57 && mProg.body.sessions.length === 1, mProg.body);
const mBench = await call('GET', `/member/workouts/progress/${BENCH._id}`, { token: A.token });
check('per-exercise progress', mBench.status === 200 && mBench.body.points.length === 1 && mBench.body.exercise.name === 'Barbell bench press' && mBench.body.best.e1rm === 57, mBench.body);

// ── Staff quick log, history and progress ──────────────────────────────────
const yesterday = shiftDay(todayKey, -1);
const staffLog = await call('POST', `/admin/workouts/members/${AID}/logs`, {
  token: TR,
  body: { date: yesterday, dayIndex: 1, entries: [{ exerciseId: SQUAT._id, sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }] }] },
});
check('trainer logs a session done at the gym (201)', staffLog.status === 201 && staffLog.body.log.loggedBy === 'staff' && staffLog.body.log.dayName === 'Day 2 – Legs', staffLog.body);
const hist = await call('GET', `/admin/workouts/members/${AID}/logs`, { token: TR });
check('staff history shows who logged', hist.body.total === 2 && hist.body.items[0].dayKey === todayKey && hist.body.items[1].loggedByName, hist.body.items?.map((i) => [i.dayKey, i.loggedByName]));
const sProg = await call('GET', `/admin/workouts/members/${AID}/progress/${SQUAT._id}`, { token: TR });
check('staff sees per-exercise progress', sProg.status === 200 && sProg.body.points[0].volumeKg === 960, sProg.body);
check('front desk cannot log sessions (403)', (await call('POST', `/admin/workouts/members/${AID}/logs`, { token: DESK, body: session })).status === 403);

// ── Change a member's copy, replace, end ───────────────────────────────────
const memberDays = mPlan.body.plan.days.map((d) => ({ name: d.name, exercises: d.exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets, reps: e.reps, weightKg: e.weightKg, restSec: e.restSec, notes: e.notes })) }));
memberDays[0].exercises[0].weightKg = 42.5;
const upd = await call('PATCH', `/admin/workouts/assignments/${ASSIGN_A}`, { token: TR, body: { days: memberDays, notes: 'Go lighter on the shoulder' } });
check("trainer adjusts one member's plan", upd.status === 200 && upd.body.assignment.version === 2 && upd.body.assignment.days[0].exercises[0].weightKg === 42.5, upd.body);
const other = await call('GET', '/member/workouts', { token: B.token });
check("other members' copies are untouched", other.body.plan.days[0].exercises[0].weightKg === 40);
const nothingToChange = await call('PATCH', `/admin/workouts/assignments/${ASSIGN_A}`, { token: TR, body: { notify: false } });
check('empty change is refused (422)', nothingToChange.status === 422);

const replace = await call('POST', `/admin/workouts/${dup.body.plan._id}/assign`, { token: MGR, body: { memberIds: [AID] }, idem: key() });
check('new plan replaces the current one', replace.status === 201 && replace.body.assignments[0].replaced?.assignmentId === ASSIGN_A, replace.body);
const ovA2 = await call('GET', `/admin/workouts/members/${AID}`, { token: TR });
check('old plan kept as history', ovA2.body.history[0]?._id === ASSIGN_A && ovA2.body.history[0].endReason === 'replaced' && ovA2.body.stats.totalSessions === 2, ovA2.body.history);
check('member plan history', (await call('GET', '/member/workouts/plans', { token: A.token })).body.items.length === 2);
const endedEdit = await call('PATCH', `/admin/workouts/assignments/${ASSIGN_A}`, { token: TR, body: { notes: 'x' } });
check('ended plans cannot be edited (409)', endedEdit.status === 409 && endedEdit.body.code === 'ASSIGNMENT_ENDED', endedEdit.body);
const ended = await call('POST', `/admin/workouts/assignments/${replace.body.assignments[0].assignmentId}/end`, { token: TR, body: { note: 'Travelling for a month' } });
check('end a plan', ended.status === 200 && ended.body.assignment.status === 'ended');
check('member with an ended plan has none current', (await call('GET', '/member/workouts', { token: A.token })).body.plan === null);

// ── Performance ────────────────────────────────────────────────────────────
const perf = await call('GET', '/admin/trainers/performance', { token: MGR });
const row = perf.body.items?.find((r) => r.trainer._id === TID);
check('trainer performance for managers', perf.status === 200 && row?.members === 2 && row.active === 2 && row.onPlan === 1 && row.sessions30 === 3, row);
check('trainer role cannot see all trainers\' numbers (403)', (await call('GET', '/admin/trainers/performance', { token: TR })).status === 403);
const own = await call('GET', `/admin/trainers/${TID}`, { token: TR });
check('trainer sees their own numbers', own.status === 200 && own.body.performance?.members === 2, own.body);
check("trainer doesn't see another trainer's numbers", (await call('GET', `/admin/trainers/${T2ID}`, { token: TR })).body.performance === null);

// ── Member app: my trainer ─────────────────────────────────────────────────
const myT = await call('GET', '/member/trainer', { token: A.token });
check('member sees their trainer with WhatsApp link', myT.status === 200 && myT.body.trainer?.name === trainerName && myT.body.trainer.contact?.whatsappUrl === 'https://wa.me/919876511111' && !('email' in myT.body.trainer), myT.body);
check('member schedule text', myT.body.trainer?.scheduleText === 'Mon 6 am–11 am, 4 pm–9 pm · Tue 6 am–11 am');
const noPhone = await call('GET', '/member/trainer', { token: C.token });
check("trainer without a phone gives no contact link", noPhone.body.trainer?.contact === null, noPhone.body);
const cAssignedElsewhere = await call('DELETE', `/admin/trainers/${T2ID}/members/${CID}`, { token: MGR });
check('member without a trainer gets null', cAssignedElsewhere.status === 200 && (await call('GET', '/member/trainer', { token: C.token })).body.trainer === null);
check('member token refused on staff workouts (403)', (await call('GET', '/admin/workouts', { token: A.token })).status === 403);

// ── Archive instead of delete ──────────────────────────────────────────────
const delPlan = await call('DELETE', `/admin/workouts/${PID}`, { token: TR });
check('plan members had is archived, not deleted', delPlan.status === 200 && delPlan.body.archived === true, delPlan.body);
const assignArchived = await call('POST', `/admin/workouts/${PID}/assign`, { token: TR, body: { memberIds: [CID] }, idem: key() });
check('archived plan cannot be given (409)', assignArchived.status === 409 && assignArchived.body.code === 'PLAN_ARCHIVED', assignArchived.body);
const restored = await call('PATCH', `/admin/workouts/${PID}`, { token: TR, body: { archived: false } });
check('restore an archived plan', restored.status === 200 && restored.body.plan.archived === false);
const fresh = await call('POST', '/admin/workouts', { token: TR, body: { name: uniq('Never used '), days: [{ name: 'Day 1', exercises: [] }] } });
check('never-used plan is deleted', (await call('DELETE', `/admin/workouts/${fresh.body.plan._id}`, { token: TR })).body.deleted === true);
const emptyAssign = await call('POST', `/admin/workouts/${fresh.body.plan._id}/assign`, { token: TR, body: { memberIds: [CID] }, idem: key() });
check('deleted plan is gone (404)', emptyAssign.status === 404);

const archBench = await call('DELETE', `/admin/exercises/${BENCH._id}`, { token: T });
check('built-in exercise used in plans is archived', archBench.status === 200 && archBench.body.archived === true && archBench.body.usage.plans >= 1, archBench.body);
const archivedList = await call('GET', '/admin/exercises?status=archived', { token: TR });
check('archived exercises listed separately', archivedList.body.items.some((e) => e._id === BENCH._id));
const reseed = await call('GET', '/admin/exercises?limit=200', { token: TR });
check('archived built-in is not re-added by seeding', !reseed.body.items.some((e) => e.name === 'Barbell bench press'));
const planStill = await call('GET', `/admin/workouts/${PID}`, { token: TR });
check('plan still shows the archived exercise by name', planStill.body.plan.days[0].exercises[0].exercise.name === 'Barbell bench press' && planStill.body.plan.days[0].exercises[0].exercise.archived === true);
const restoreEx = await call('PATCH', `/admin/exercises/${BENCH._id}`, { token: T, body: { archived: false } });
check('restore an exercise', restoreEx.status === 200 && restoreEx.body.exercise.archived === false);

const blank = await call('POST', '/admin/workouts', { token: TR, body: { name: uniq('Blank '), days: [{ name: 'Day 1', exercises: [] }] } });
const blankAssign = await call('POST', `/admin/workouts/${blank.body.plan._id}/assign`, { token: TR, body: { memberIds: [CID] }, idem: key() });
check('a plan with no exercises cannot be given (422)', blankAssign.status === 422 && blankAssign.body.code === 'PLAN_EMPTY', blankAssign.body);

// Photo upload: a non-image is refused before anything is written to disk.
const form = new FormData();
form.append('photo', new Blob(['not an image'], { type: 'text/plain' }), 'notes.txt');
const badPhoto = await call('POST', `/admin/trainers/${TID}/photo`, { token: MGR, body: form });
check('trainer photo must be an image (422)', badPhoto.status === 422 && badPhoto.body.details.fields.photo, badPhoto.body);
const noPhotoFile = await call('POST', `/admin/trainers/${TID}/photo`, { token: MGR, body: new FormData() });
check('photo upload without a file explains (422)', noPhotoFile.status === 422, noPhotoFile.body);
check('trainer role cannot change trainer photos (403)', (await call('POST', `/admin/trainers/${TID}/photo`, { token: TR, body: new FormData() })).status === 403);

const delLog = await call('DELETE', `/admin/workouts/logs/${staffLog.body.log._id}`, { token: TR });
check('trainer deletes a wrong session', delLog.status === 200 && (await call('GET', `/admin/workouts/members/${AID}/logs`, { token: TR })).body.total === 1);

finish();
