import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crowdForecast, weekStrip } from '../services/memberHomeService.js';

test('week strip runs Monday to Sunday with visited days and today marked', () => {
  // 1 Oct 2026 is a Thursday.
  const week = weekStrip(['2026-09-28', '2026-09-30', '2026-10-01', '2026-09-25'], '2026-10-01');
  assert.deepEqual(week.map((d) => d.label), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(week[0].day, '2026-09-28');
  assert.deepEqual(week.map((d) => d.visited), [true, false, true, true, false, false, false]);
  assert.equal(week[3].isToday, true);
  assert.equal(week[4].isFuture, true);
  // On a Sunday the week still starts on the Monday before.
  assert.equal(weekStrip([], '2026-10-04')[0].day, '2026-09-28');
});

test('crowd: busy near the peak, with a quieter hour suggested', () => {
  const rows = [
    { _id: 6, n: 40 },
    { _id: 7, n: 32 },
    { _id: 8, n: 12 },
    { _id: 18, n: 36 },
    { _id: 19, n: 20 },
    { _id: 20, n: 8 },
  ];
  const at7 = crowdForecast(rows, 4, 7);
  assert.equal(at7.level, 'busy');
  assert.equal(at7.quieterAt, 8);
  assert.equal(at7.hours[0].hour, 5, 'one hour of margin before the first busy hour');
  assert.equal(at7.hours.at(-1).hour, 21);
  assert.equal(crowdForecast(rows, 4, 19).level, 'moderate');
  assert.equal(crowdForecast(rows, 4, 13).level, 'quiet');
  assert.deepEqual(crowdForecast([], 4, 9), { hours: [], level: 'quiet', quieterAt: null, hourNow: 9 });
});
