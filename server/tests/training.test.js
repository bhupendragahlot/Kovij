import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestSet,
  estimateOneRepMax,
  exerciseNameKey,
  exerciseOverview,
  exerciseSeries,
  formatClock,
  memberStanding,
  normalizeSchedule,
  personalBest,
  scheduleProblems,
  standingFromStatuses,
  suggestNextDay,
  summarizeEntries,
  summarizeSchedule,
  summarizeTrainerPerformance,
} from '../services/training/math.js';
import { EXERCISE_SEED } from '../services/training/exerciseSeed.js';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLES } from '../services/training/constants.js';
import { logSchema, planSchema, rosterQuery } from '../validators/workout.schema.js';
import { scheduleSchema, trainerSchema } from '../validators/trainer.schema.js';
import { exerciseSchema } from '../validators/exercise.schema.js';
import { workoutAssignedEmail } from '../services/training/emails.js';
import { contactLinks } from '../services/training/trainerService.js';

const BENCH = '64f000000000000000000001';
const SQUAT = '64f000000000000000000002';
const PUSHUP = '64f000000000000000000003';
const at = (day) => new Date(`${day}T00:00:00+05:30`);

test('estimated 1RM: Epley, rounded to 0.5 kg, zero without load', () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.equal(estimateOneRepMax(100, 10), 133.5); // 133.33 → 133.5
  assert.equal(estimateOneRepMax(60, 5), 70);
  assert.equal(estimateOneRepMax(0, 20), 0);
  assert.equal(estimateOneRepMax(50, 0), 0);
  assert.equal(estimateOneRepMax('80', '3'), 88);
});

test('session totals count only finished sets', () => {
  const totals = summarizeEntries([
    { sets: [{ reps: 10, weightKg: 50, done: true }, { reps: 8, weightKg: 50 }, { reps: 8, weightKg: 50, done: false }] },
    { sets: [{ reps: 15, weightKg: 0, done: true }, { reps: 0, weightKg: 40, done: true }] },
  ]);
  assert.deepEqual(totals, { volumeKg: 900, setsDone: 3, repsDone: 33 });
  assert.deepEqual(summarizeEntries([]), { volumeKg: 0, setsDone: 0, repsDone: 0 });
});

test('best set prefers the highest estimated 1RM, then load, then reps', () => {
  // 60 × 10 estimates 80 kg; 70 × 3 only 77 kg; the unfinished 90 × 5 doesn't count.
  assert.deepEqual(bestSet([{ reps: 10, weightKg: 60 }, { reps: 3, weightKg: 70 }, { reps: 5, weightKg: 90, done: false }]), {
    reps: 10,
    weightKg: 60,
    e1rm: 80,
  });
  // Bodyweight: most reps wins.
  assert.deepEqual(bestSet([{ reps: 12, weightKg: 0 }, { reps: 20, weightKg: 0 }]), { reps: 20, weightKg: 0, e1rm: 0 });
  assert.equal(bestSet([{ reps: 10, weightKg: 50, done: false }]), null);
});

test('exercise series and personal best follow the sessions in date order', () => {
  const logs = [
    { _id: 'b', dayKey: '2026-09-10', performedAt: at('2026-09-10'), entries: [{ exerciseId: BENCH, name: 'Bench', sets: [{ reps: 5, weightKg: 70 }] }] },
    { _id: 'a', dayKey: '2026-09-03', performedAt: at('2026-09-03'), entries: [{ exerciseId: BENCH, name: 'Bench', sets: [{ reps: 8, weightKg: 60 }, { reps: 8, weightKg: 60 }] }] },
    { _id: 'c', dayKey: '2026-09-12', performedAt: at('2026-09-12'), entries: [{ exerciseId: SQUAT, name: 'Squat', sets: [{ reps: 5, weightKg: 100 }] }] },
  ];
  const series = exerciseSeries(logs, BENCH);
  assert.deepEqual(series.map((p) => p.dayKey), ['2026-09-03', '2026-09-10']);
  assert.deepEqual(series[0], { logId: 'a', dayKey: '2026-09-03', bestSet: { reps: 8, weightKg: 60 }, e1rm: 76, volumeKg: 960, reps: 16, sets: 2 });
  assert.equal(personalBest(series).dayKey, '2026-09-10');
  assert.equal(personalBest([]), null);

  const overview = exerciseOverview(logs);
  assert.deepEqual(overview.map((r) => r.name), ['Squat', 'Bench']);
  assert.deepEqual(overview[1], {
    exerciseId: BENCH,
    name: 'Bench',
    sessions: 2,
    lastDayKey: '2026-09-10',
    last: { reps: 5, weightKg: 70, e1rm: 81.5 },
    best: { reps: 5, weightKg: 70, e1rm: 81.5, dayKey: '2026-09-10' },
  });
});

test('suggested day rotates through the plan, whatever the calendar', () => {
  const log = (dayKey, dayIndex, createdAt = dayKey) => ({ dayKey, dayIndex, performedAt: at(dayKey), createdAt: new Date(`${createdAt}T12:00:00Z`) });
  assert.equal(suggestNextDay({ dayCount: 0, logs: [], todayKey: '2026-09-30' }), null);
  assert.deepEqual(suggestNextDay({ dayCount: 3, logs: [], todayKey: '2026-09-30' }), { dayIndex: 0, doneToday: false, lastDayKey: null });
  // Did day 2 (index 1) last, several days ago: next is index 2.
  assert.deepEqual(suggestNextDay({ dayCount: 3, logs: [log('2026-09-20', 0), log('2026-09-25', 1)], todayKey: '2026-09-30' }), {
    dayIndex: 2,
    doneToday: false,
    lastDayKey: '2026-09-25',
  });
  // After the last day it wraps to the first.
  assert.equal(suggestNextDay({ dayCount: 3, logs: [log('2026-09-28', 2)], todayKey: '2026-09-30' }).dayIndex, 0);
  // Already trained today: show today's day as done.
  assert.deepEqual(suggestNextDay({ dayCount: 3, logs: [log('2026-09-29', 0), log('2026-09-30', 1)], todayKey: '2026-09-30' }), {
    dayIndex: 1,
    doneToday: true,
    lastDayKey: '2026-09-30',
  });
  // A day index the plan no longer has (plan was shortened) is ignored.
  assert.equal(suggestNextDay({ dayCount: 2, logs: [log('2026-09-29', 5)], todayKey: '2026-09-30' }).dayIndex, 0);
});

test('trainer performance folds member facts per trainer', () => {
  const rows = [
    { trainerId: 't1', standing: 'active', visits30: 12, onPlan: true, sessions30: 8 },
    { trainerId: 't1', standing: 'lapsed', visits30: 0, onPlan: false, sessions30: 0 },
    { trainerId: 't1', standing: 'active', visits30: 5, onPlan: true, sessions30: 2 },
    { trainerId: 'other', standing: 'active', visits30: 99, onPlan: true, sessions30: 9 },
  ];
  const [t1, t2] = summarizeTrainerPerformance(['t1', 't2'], rows);
  assert.deepEqual(t1, { trainerId: 't1', members: 3, active: 2, lapsed: 1, onPlan: 2, sessions30: 10, visits30: 17, avgVisits30: 5.7 });
  assert.deepEqual(t2, { trainerId: 't2', members: 0, active: 0, lapsed: 0, onPlan: 0, sessions30: 0, visits30: 0, avgVisits30: 0 });
  assert.equal(standingFromStatuses(['expired', 'active']), 'active');
  assert.equal(standingFromStatuses(['expired', 'upcoming']), 'waiting');
  assert.equal(standingFromStatuses(['cancelled']), 'lapsed');
  assert.equal(standingFromStatuses([]), 'none');
});

test('member standing matches the members list states', () => {
  const now = new Date('2026-09-30T06:00:00Z');
  const ms = (status, endDate) => ({ status, endDate: new Date(endDate), planName: status });
  assert.equal(memberStanding([ms('active', '2026-12-01')], now).state, 'active');
  assert.equal(memberStanding([ms('active', '2026-10-03')], now, 7).state, 'expiring');
  assert.equal(memberStanding([ms('expired', '2026-08-01'), ms('pending', '2026-11-01')], now).state, 'pending');
  assert.equal(memberStanding([ms('expired', '2026-08-01'), ms('cancelled', '2026-09-01')], now).current.status, 'cancelled');
  assert.deepEqual(memberStanding([], now), { state: 'none', current: null });
});

test('schedules: validation, ordering and a readable summary', () => {
  const week = [
    { day: 6, shifts: [{ start: '06:00', end: '11:00' }] },
    ...[1, 2, 3, 4, 5].map((day) => ({ day, shifts: [{ start: '16:00', end: '21:00' }, { start: '06:00', end: '11:00' }] })),
    { day: 0, shifts: [] },
  ];
  assert.deepEqual(scheduleProblems(week), []);
  assert.deepEqual(normalizeSchedule(week).map((d) => d.day), [1, 2, 3, 4, 5, 6]);
  assert.equal(normalizeSchedule(week)[0].shifts[0].start, '06:00');
  assert.equal(summarizeSchedule(week), 'Mon–Fri 6 am–11 am, 4 pm–9 pm · Sat 6 am–11 am');
  assert.equal(summarizeSchedule([]), '');
  const alternate = [1, 3, 5].map((day) => ({ day, shifts: [{ start: '07:00', end: '10:00' }] }));
  assert.equal(summarizeSchedule(alternate), 'Mon, Wed, Fri 7 am–10 am');
  assert.equal(
    summarizeSchedule([...[1, 2, 3, 5].map((day) => ({ day, shifts: [{ start: '06:00', end: '09:30' }] })), { day: 0, shifts: [{ start: '08:00', end: '12:00' }] }]),
    'Sun 8 am–12 pm · Mon–Wed, Fri 6 am–9:30 am'
  );
  assert.equal(formatClock('00:30'), '12:30 am');
  assert.equal(formatClock('12:00'), '12 pm');

  const bad = [
    { day: 1, shifts: [{ start: '10:00', end: '09:00' }] },
    { day: 2, shifts: [{ start: '06:00', end: '10:00' }, { start: '09:00', end: '12:00' }] },
    { day: 1, shifts: [] },
  ];
  assert.deepEqual(
    scheduleProblems(bad).map((p) => p.path.join('.')),
    ['0.shifts.0.end', '1.shifts.1.start', '2.day']
  );
  const parsed = scheduleSchema.safeParse(bad);
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.errors[0].message, 'End time must be after the start time');
  assert.equal(scheduleSchema.safeParse([{ day: 1, shifts: [{ start: '6am', end: '11:00' }] }]).success, false);
});

test('trainer input: safe links, phone and schedule', () => {
  const base = { name: 'Ravi', role: 'Strength coach' };
  assert.equal(trainerSchema.safeParse({ ...base, image: 'javascript:alert(1)' }).success, false);
  assert.equal(trainerSchema.safeParse({ ...base, instagram: 'https://instagram.com/ravi' }).success, true);
  assert.equal(trainerSchema.safeParse({ ...base, image: '/uploads/avatars/a.jpg' }).success, true);
  assert.equal(trainerSchema.safeParse({ ...base, phone: 'call me' }).success, false);
  const ok = trainerSchema.parse({ ...base, image: '', userId: null });
  assert.equal(ok.image, undefined);
  assert.equal(ok.userId, null);
  assert.deepEqual(ok.schedule, []);
});

test('plan and log validation', () => {
  const plan = planSchema.safeParse({ name: 'Full body', days: [{ name: 'Day 1', exercises: [{ exerciseId: BENCH, sets: 3, reps: '8-12', weightKg: '' }] }] });
  assert.equal(plan.success, true);
  assert.equal(plan.data.days[0].exercises[0].weightKg, undefined);
  assert.equal(plan.data.days[0].exercises[0].restSec, 60);
  const noDays = planSchema.safeParse({ name: 'x', days: [] });
  assert.equal(noDays.error.errors[0].message, 'Add at least one day');
  const badSets = planSchema.safeParse({ name: 'x', days: [{ name: 'D', exercises: [{ exerciseId: BENCH, sets: 0, reps: '5' }] }] });
  assert.deepEqual(badSets.error.errors[0].path, ['days', 0, 'exercises', 0, 'sets']);

  const log = logSchema.safeParse({ date: '2026-09-30', entries: [{ exerciseId: PUSHUP, sets: [{ reps: 15, weightKg: '' }] }] });
  assert.equal(log.success, true);
  assert.deepEqual(log.data.entries[0].sets[0], { reps: 15, weightKg: 0, done: true });
  assert.equal(log.data.dayIndex, 0);
  const nothingDone = logSchema.safeParse({ entries: [{ exerciseId: PUSHUP, sets: [{ reps: 10, done: false }] }] });
  assert.equal(nothingDone.error.errors[0].message, 'Tick at least one set that was finished');
  assert.equal(logSchema.safeParse({ date: '2026-02-31', entries: [{ exerciseId: PUSHUP, sets: [{ reps: 1 }] }] }).success, false);
  assert.equal(rosterQuery.parse({}).who, 'all');
  assert.equal(rosterQuery.safeParse({ who: 'someone' }).success, false);
});

test('built-in exercise library is well formed', () => {
  assert.ok(EXERCISE_SEED.length >= 60, `only ${EXERCISE_SEED.length}`);
  const keys = new Set();
  const names = new Set();
  for (const e of EXERCISE_SEED) {
    assert.ok(!keys.has(e.seedKey), `duplicate seedKey ${e.seedKey}`);
    assert.ok(!names.has(exerciseNameKey(e.name)), `duplicate name ${e.name}`);
    keys.add(e.seedKey);
    names.add(exerciseNameKey(e.name));
    assert.ok(MUSCLES.includes(e.primaryMuscle), `${e.name} muscle`);
    assert.ok(e.secondaryMuscles.every((m) => MUSCLES.includes(m)), `${e.name} secondary`);
    assert.ok(EQUIPMENT.includes(e.equipment), `${e.name} equipment`);
    assert.ok(EXERCISE_CATEGORIES.includes(e.category), `${e.name} category`);
    assert.ok(e.instructions.length > 20, `${e.name} instructions`);
    assert.equal(exerciseSchema.safeParse(e).success, true, e.name);
  }
  assert.equal(exerciseNameKey('  Push-Up '), exerciseNameKey('push up'));
});

test('exercise video links must be web links', () => {
  const base = { name: 'Squat', primaryMuscle: 'quads', equipment: 'barbell' };
  assert.equal(exerciseSchema.safeParse({ ...base, videoUrl: 'javascript:alert(1)' }).success, false);
  assert.equal(exerciseSchema.safeParse({ ...base, videoUrl: 'https://youtu.be/abc' }).success, true);
  assert.equal(exerciseSchema.parse({ ...base, videoUrl: '' }).videoUrl, '');
});

test('workout email escapes everything it shows', () => {
  const { subject, html } = workoutAssignedEmail({
    name: '<b>Asha</b>',
    planName: 'Push <script>x</script>',
    startDay: '2026-10-05',
    daysPerWeek: 3,
    days: [{ name: 'Day 1 <i>', exercises: [{ name: 'Bench & press' }] }],
    trainerName: 'Ravi <u>',
    gymName: 'Kovij',
  });
  assert.ok(subject.includes('Push <script>x</script>')); // subjects are plain text
  assert.ok(!html.includes('<script>x') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Asha') && !html.includes('<b>Asha'));
  assert.ok(html.includes('Bench &amp; press') && html.includes('Monday, 5 October'));
});

test('trainer contact links for members', () => {
  assert.deepEqual(contactLinks('9876543210'), { phone: '9876543210', telUrl: 'tel:+919876543210', whatsappUrl: 'https://wa.me/919876543210' });
  assert.equal(contactLinks(''), null);
});
