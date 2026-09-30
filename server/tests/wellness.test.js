import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  annotateEntries,
  bmiCategory,
  caloriesFromMacros,
  changeBetween,
  computeBmi,
  dayOffset,
  daysBetween,
  isRealDay,
  normalizeFoodItem,
  nutritionDay,
  planInEffect,
  planTotals,
  progressSummary,
  shiftDay,
  sumMacros,
} from '../services/wellnessMath.js';
import { detectImageType } from '../services/progressPhotoService.js';
import { dietPlanSchema, measurementSchema, notePatchSchema, photoFieldsSchema } from '../validators/wellness.schema.js';
import { dietPlanAssignedEmail } from '../services/emailTemplates/wellnessTemplates.js';

const at = (iso) => new Date(iso);

test('totals are summed in code: whole calories, grams to one decimal', () => {
  const items = [
    { calories: 120.4, proteinG: 4.25, carbsG: 20, fatG: 3.1 },
    { calories: 80.3, proteinG: 0.1, carbsG: 0.15, fatG: 9 },
  ];
  assert.deepEqual(sumMacros(items), { calories: 201, proteinG: 4.4, carbsG: 20.2, fatG: 12.1 });
  assert.deepEqual(sumMacros([]), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  assert.deepEqual(sumMacros([{ calories: undefined, proteinG: NaN }]), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
});

test('blank calories are worked out from macros (4/4/9); entered calories win', () => {
  assert.equal(caloriesFromMacros({ proteinG: 10, carbsG: 20, fatG: 5 }), 165);
  assert.equal(normalizeFoodItem({ food: ' Paneer bhurji ', quantity: '1 katori', proteinG: 18, carbsG: 6, fatG: 20 }).calories, 276);
  const entered = normalizeFoodItem({ food: 'Dal', calories: 150, proteinG: 9 });
  assert.equal(entered.calories, 150);
  assert.equal(entered.food, 'Dal');
  assert.equal(entered.carbsG, 0);
});

test('plan totals per meal and per day', () => {
  const meals = [
    { name: 'Breakfast', items: [{ calories: 300, proteinG: 12, carbsG: 45, fatG: 8 }, { calories: 70, proteinG: 6, carbsG: 0, fatG: 5 }] },
    { name: 'Lunch', items: [{ calories: 500, proteinG: 20, carbsG: 70, fatG: 12 }] },
    { name: 'Empty', items: [] },
  ];
  const t = planTotals(meals);
  assert.deepEqual(t.meals[0], { calories: 370, proteinG: 18, carbsG: 45, fatG: 13 });
  assert.deepEqual(t.meals[2], { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  assert.deepEqual(t.day, { calories: 870, proteinG: 38, carbsG: 115, fatG: 25 });
});

test('a day counts ticked meals of this plan plus extras; stale ticks are ignored', () => {
  const meals = [
    { _id: 'm1', name: 'Breakfast', items: [{ calories: 400, proteinG: 20, carbsG: 50, fatG: 10 }] },
    { _id: 'm2', name: 'Lunch', items: [{ calories: 600, proteinG: 30, carbsG: 70, fatG: 15 }] },
  ];
  const day = nutritionDay({
    meals,
    eatenMealIds: ['m1', 'old-plan-meal'],
    extras: [{ calories: 150, proteinG: 2, carbsG: 20, fatG: 7 }],
    targets: { calories: 1800 },
  });
  assert.equal(day.mealsEaten, 1);
  assert.equal(day.mealsPlanned, 2);
  assert.deepEqual(day.eaten, { calories: 550, proteinG: 22, carbsG: 70, fatG: 17 });
  assert.equal(day.planned.calories, 1000);
  assert.equal(day.remainingCalories, 1250);
  assert.equal(nutritionDay({ meals: [], extras: [] }).remainingCalories, null, 'no target, no remaining');
});

test('BMI from weight and height, with Asia-Pacific bands', () => {
  assert.equal(computeBmi(70, 175), 22.9);
  assert.equal(computeBmi(70, null), null);
  assert.equal(computeBmi(0, 170), null);
  assert.equal(bmiCategory(18.4).key, 'underweight');
  assert.equal(bmiCategory(18.5).key, 'healthy');
  assert.equal(bmiCategory(22.9).key, 'healthy');
  assert.equal(bmiCategory(23).key, 'overweight');
  assert.equal(bmiCategory(24.9).key, 'overweight');
  assert.equal(bmiCategory(25).key, 'obese');
  assert.equal(bmiCategory(23.4).range, '23 to 24.9');
  assert.equal(bmiCategory(31).range, '25 and above');
  assert.equal(bmiCategory(null), null);
});

test('change since previous and since first is per field (entries are often partial)', () => {
  const entries = [
    { day: '2026-07-01', weightKg: 82, waistCm: 96 },
    { day: '2026-08-01', weightKg: 80.4 },
    { day: '2026-09-01', weightKg: 79.1, waistCm: 92.5 },
  ];
  const out = annotateEntries(entries);
  assert.deepEqual(out[0].sincePrevious, {});
  assert.deepEqual(out[1].sincePrevious, { weightKg: -1.6 });
  assert.deepEqual(out[2].sincePrevious, { weightKg: -1.3, waistCm: -3.5 });
  assert.deepEqual(out[2].sinceFirst, { weightKg: -2.9, waistCm: -3.5 });
  assert.deepEqual(changeBetween(entries[0], entries[2], ['weightKg', 'waistCm', 'hipsCm']), { weightKg: -2.9, waistCm: -3.5 });
});

test('progress summary: first vs latest, BMI band from the latest BMI', () => {
  const s = progressSummary(
    [
      { day: '2026-07-01', weightKg: 82, bmi: 26.8 },
      { day: '2026-09-01', weightKg: 79, bmi: 25.8, bodyFatPct: 24 },
    ],
    { heightCm: 175 }
  );
  assert.equal(s.entries, 2);
  assert.equal(s.latest.weightKg, 79);
  assert.equal(s.change.weightKg, -3);
  assert.equal(s.change.bodyFatPct, undefined, 'one reading has no change');
  assert.equal(s.bmiCategory.key, 'obese');
  assert.equal(s.heightCm, 175);
  const empty = progressSummary([]);
  assert.equal(empty.entries, 0);
  assert.equal(empty.bmiCategory, null);
});

test('gym days: real dates only, offsets in gym time, ranges newest first', () => {
  assert.ok(isRealDay('2026-02-28'));
  assert.ok(!isRealDay('2026-02-30'));
  assert.ok(!isRealDay('30-09-2026'));
  assert.ok(!isRealDay(undefined));
  // 20:00 UTC on 30 Sep is already 1 Oct in Kota.
  const now = at('2026-09-30T20:00:00Z');
  assert.equal(dayOffset('2026-10-01', now), 0);
  assert.equal(dayOffset('2026-09-30', now), -1);
  assert.equal(dayOffset('2026-10-02', now), 1);
  assert.deepEqual(daysBetween('2026-09-29', '2026-10-01'), ['2026-10-01', '2026-09-30', '2026-09-29']);
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
});

test('plan in effect: a replacement takes over on its start day; a stopped plan ends that day', () => {
  // Plan A from 1 Sep, replaced by B from 10 Sep (A ends where B starts, 00:00 IST = 18:30 UTC the day before).
  const a = { _id: 'a1', startDate: at('2026-08-31T18:30:00Z'), endedAt: at('2026-09-09T18:30:00Z') };
  const b = { _id: 'b1', startDate: at('2026-09-09T18:30:00Z') };
  assert.equal(planInEffect([a, b], '2026-09-09')._id, 'a1');
  assert.equal(planInEffect([a, b], '2026-09-10')._id, 'b1');
  assert.equal(planInEffect([a, b], '2026-08-31'), null);
  // Stopped at 3 pm on 20 Sep: not in effect that day any more, still in effect the day before.
  const stopped = { ...b, endedAt: at('2026-09-20T09:30:00Z') };
  assert.equal(planInEffect([stopped], '2026-09-20'), null);
  assert.equal(planInEffect([stopped], '2026-09-19')._id, 'b1');
  // An upcoming plan doesn't apply before it starts.
  const upcoming = { _id: 'c1', startDate: at('2026-10-04T18:30:00Z') };
  assert.equal(planInEffect([upcoming], '2026-10-01'), null);
});

test('photo type is read from the bytes, not the claimed type', () => {
  const pad = Buffer.alloc(16);
  assert.equal(detectImageType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), 'image/jpeg');
  assert.equal(detectImageType(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), 'image/png');
  assert.equal(detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), pad])), 'image/webp');
  assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(detectImageType(Buffer.concat([Buffer.from('%PDF-1.7'), pad])), null);
  assert.equal(detectImageType(Buffer.concat([Buffer.from('GIF89a'), pad])), null, 'GIFs are not progress photos');
  assert.equal(detectImageType(Buffer.alloc(3)), null);
});

test('validation: plans, measurements, photos and notes', () => {
  const plan = dietPlanSchema.parse({ name: 'Veg fat loss', meals: [{ name: 'Breakfast', time: '07:30', items: [{ food: 'Poha', proteinG: 5 }] }] });
  assert.equal(plan.dietType, 'veg');
  assert.equal(plan.meals[0].items[0].quantity, '');
  assert.ok(!dietPlanSchema.safeParse({ name: 'X' }).success, 'name too short');
  assert.ok(!dietPlanSchema.safeParse({ name: 'Plan', meals: [{ name: 'B', time: '7:30' }] }).success, 'time must be HH:MM');
  assert.ok(!dietPlanSchema.safeParse({ name: 'Plan', dietType: 'keto' }).success);

  assert.ok(measurementSchema.safeParse({ weightKg: 72.5 }).success);
  const noMeasure = measurementSchema.safeParse({ heightCm: 170, notes: 'x' });
  assert.ok(!noMeasure.success);
  assert.equal(noMeasure.error.issues[0].path.join('.'), 'weightKg');
  assert.ok(!measurementSchema.safeParse({ weightKg: 900 }).success);
  assert.ok(!measurementSchema.safeParse({ weightKg: '72' }).success, 'numbers only');
  assert.ok(!measurementSchema.safeParse({ weightKg: 70, day: '2026-02-30' }).success);

  assert.ok(photoFieldsSchema.safeParse({ pose: 'side', day: '2026-09-01' }).success);
  assert.ok(!photoFieldsSchema.safeParse({ pose: 'top' }).success);
  assert.ok(!notePatchSchema.safeParse({}).success, 'empty patch');
});

test('diet email escapes everything and carries no body numbers', () => {
  const { subject, html } = dietPlanAssignedEmail({ name: '<b>Ravi</b>', planName: 'Plan <script>', trainerName: 'Neha & Co', startDate: at('2026-10-01T00:00:00Z'), gymName: 'Kovij' });
  assert.equal(subject, 'Your diet plan from Kovij');
  assert.ok(html.includes('&lt;b&gt;Ravi&lt;/b&gt;'));
  assert.ok(html.includes('Plan &lt;script&gt;'));
  assert.ok(html.includes('Neha &amp; Co'));
  assert.ok(!/kcal|calorie|kg/i.test(html));
});
