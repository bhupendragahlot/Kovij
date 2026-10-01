import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRenewal, heatmapFromRows, renewalSummary, resolvePeriod } from '../services/reportService.js';

// 30 Sep 2026, 3:30 pm in Kota.
const NOW = new Date('2026-09-30T10:00:00Z');
const day = (s) => new Date(`${s}T00:00:00+05:30`);

test('default period is this month so far, compared with the same number of days before it', () => {
  const p = resolvePeriod({}, NOW);
  assert.equal(p.fromKey, '2026-09-01');
  assert.equal(p.toKey, '2026-09-30');
  assert.equal(p.days, 30);
  assert.equal(p.prev.fromKey, '2026-08-02');
  assert.equal(p.prev.toKey, '2026-08-31');
  assert.deepEqual(p.from, day('2026-09-01'));
  assert.deepEqual(p.to, day('2026-10-01'), 'the end is exclusive: the start of the next gym day');
});

test('custom periods: inclusive days, refused when backwards or longer than a year', () => {
  const p = resolvePeriod({ from: '2026-07-01', to: '2026-07-31' }, NOW);
  assert.equal(p.days, 31);
  assert.equal(p.prev.fromKey, '2026-05-31');
  assert.throws(() => resolvePeriod({ from: '2026-07-10', to: '2026-07-01' }, NOW), /before the end/);
  assert.throws(() => resolvePeriod({ from: '2024-01-01', to: '2026-01-01' }, NOW), /at most a year/);
  assert.equal(resolvePeriod({ from: '2026-09-30', to: '2026-09-30' }, NOW).days, 1);
});

test('renewal outcomes', () => {
  const endDate = day('2026-08-01');
  assert.equal(classifyRenewal({ endDate, nextStart: day('2026-07-25') }, NOW), 'on_time', 'queued before the end');
  assert.equal(classifyRenewal({ endDate, nextStart: day('2026-08-02') }, NOW), 'on_time', 'started the next day');
  assert.equal(classifyRenewal({ endDate, nextStart: day('2026-08-20') }, NOW), 'late');
  assert.equal(classifyRenewal({ endDate, nextStart: day('2026-09-15') }, NOW), 'lost', 'came back after the grace period');
  assert.equal(classifyRenewal({ endDate }, NOW), 'lost');
  assert.equal(classifyRenewal({ endDate: day('2026-09-20') }, NOW), 'undecided', 'ended 10 days ago, could still renew');
});

test('renewal rate only counts plans whose outcome is known', () => {
  assert.deepEqual(renewalSummary(['on_time', 'on_time', 'late', 'lost', 'undecided']), { ended: 5, on_time: 2, late: 1, undecided: 1, lost: 1, rate: 75 });
  assert.equal(renewalSummary(['undecided']).rate, null);
  assert.equal(renewalSummary([]).rate, null);
});

test('heatmap: Monday first, busiest slot found', () => {
  const { grid, busiest } = heatmapFromRows([
    { _id: { dow: 2, hour: 6 }, n: 12 }, // Monday 6 am
    { _id: { dow: 1, hour: 18 }, n: 4 }, // Sunday 6 pm
    { _id: { dow: 7, hour: 19 }, n: 30 }, // Saturday 7 pm
  ]);
  assert.equal(grid.length, 7);
  assert.equal(grid[0][6], 12);
  assert.equal(grid[6][18], 4);
  assert.equal(grid[5][19], 30);
  assert.deepEqual(busiest, { day: 5, hour: 19, count: 30 });
  assert.equal(heatmapFromRows([]).busiest, null);
});
