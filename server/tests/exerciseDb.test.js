/**
 * ExerciseDB client (services/training/exerciseDb.js) against a fake fetch, and the schedule rules
 * in exerciseAssignmentService that don't need a database.
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayName,
  exerciseDbConfig,
  exerciseDbFilters,
  getExerciseDbExercise,
  nextMediaRotation,
  normalizeExercise,
  rankByName,
  resetExerciseDbCache,
  searchExerciseDb,
  setExerciseDbFetch,
  toGymCategory,
  toGymEquipment,
  toGymMuscle,
} from '../services/training/exerciseDb.js';
import { assignmentState, scheduleWindows, summarize } from '../services/training/exerciseAssignmentService.js';

// Shapes copied from real responses (oss.exercisedb.dev and docs.ascendapi.com, Oct 2026).
const FREE = {
  exerciseId: 'EIeI8Vf',
  name: 'barbell bench press',
  gifUrl: 'https://static.exercisedb.dev/media/EIeI8Vf.gif',
  targetMuscles: ['pectorals'],
  bodyParts: ['chest'],
  equipments: ['barbell'],
  secondaryMuscles: ['triceps', 'shoulders'],
  instructions: ['Step:1 Lie flat on a bench.', 'Step:2 Grasp the barbell.', 'Step:7 Repeat.'],
};
const PAID = {
  exerciseId: 'edb_T5uXtLj',
  name: 'Lever Pec Deck Fly',
  bodyParts: ['chest'],
  targetMuscles: ['pectorals'],
  secondaryMuscles: ['deltoids'],
  equipments: ['leverage machine'],
  difficulty: 'intermediate',
  exerciseTypes: ['strength'],
  overview: 'A machine fly for the chest.',
  imageUrls: { '360p': 'https://assets.exercisedb.dev/media/a.png', '720p': 'https://assets.exercisedb.dev/media/b.png' },
  gifUrls: { '360p': 'https://assets.exercisedb.dev/media/c.gif', '720p': 'https://assets.exercisedb.dev/media/d.gif' },
  instructions: ['Sit on the machine.'],
  relatedExerciseIds: ['edb_1', 'edb_2'],
};

/** Fake fetch: `routes` maps a path (no host) to a response or a function returning one. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, search: u.search, params: Object.fromEntries(u.searchParams), headers: init?.headers || {} });
    const route = routes[u.pathname];
    const r = typeof route === 'function' ? route(u) : route;
    if (!r) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    if (r.throw) throw r.throw;
    return new Response(JSON.stringify(r.body), { status: r.status || 200, headers: r.headers || {} });
  };
  fn.calls = calls;
  return fn;
}

const saved = { ...process.env };
beforeEach(() => {
  resetExerciseDbCache();
  delete process.env.EXERCISEDB_RAPIDAPI_KEY;
  delete process.env.EXERCISEDB_BASE_URL;
  delete process.env.EXERCISEDB_CACHE_TTL_SECONDS;
});
afterEach(() => {
  setExerciseDbFetch();
  for (const k of ['EXERCISEDB_RAPIDAPI_KEY', 'EXERCISEDB_BASE_URL', 'EXERCISEDB_CACHE_TTL_SECONDS']) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── Configuration ──────────────────────────────────────────────────────────

test('free host by default; a RapidAPI key switches to the paid host; TTL 0 turns caching off', () => {
  assert.deepEqual(exerciseDbConfig({}), { base: 'https://oss.exercisedb.dev', key: '', ttlMs: 6 * 3600 * 1000, tier: 'free' });
  const paid = exerciseDbConfig({ EXERCISEDB_RAPIDAPI_KEY: ' k1 ' });
  assert.equal(paid.base, 'https://edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com');
  assert.equal(paid.key, 'k1');
  assert.equal(paid.tier, 'rapidapi');
  assert.equal(exerciseDbConfig({ EXERCISEDB_BASE_URL: 'http://127.0.0.1:9/', EXERCISEDB_CACHE_TTL_SECONDS: '0' }).base, 'http://127.0.0.1:9');
  assert.equal(exerciseDbConfig({ EXERCISEDB_CACHE_TTL_SECONDS: '0' }).ttlMs, 0);
  assert.equal(exerciseDbConfig({ EXERCISEDB_CACHE_TTL_SECONDS: 'abc' }).ttlMs, 0);
});

test('media links rotate every Monday 00:00 UTC', () => {
  const at = (iso) => new Date(nextMediaRotation(Date.parse(iso))).toISOString();
  assert.equal(at('2026-10-05T00:00:00Z'), '2026-10-12T00:00:00.000Z'); // Monday midnight → next Monday
  assert.equal(at('2026-10-04T23:59:00Z'), '2026-10-05T00:00:00.000Z'); // Sunday night → hours away
  assert.equal(at('2026-10-07T10:00:00Z'), '2026-10-12T00:00:00.000Z'); // Wednesday
});

// ── Normalising ────────────────────────────────────────────────────────────

test('free-host record: clean steps, sentence-case name, gym vocabulary', () => {
  const e = normalizeExercise(FREE);
  assert.equal(e.id, 'EIeI8Vf');
  assert.equal(e.name, 'Barbell bench press');
  assert.deepEqual(e.instructions, ['Lie flat on a bench.', 'Grasp the barbell.', 'Repeat.']);
  assert.equal(e.gifUrl, FREE.gifUrl);
  assert.equal(e.thumbUrl, FREE.gifUrl);
  assert.deepEqual([e.primaryMuscle, e.equipment, e.category], ['chest', 'barbell', 'strength']);
  assert.equal(e.imageUrl, '');
  assert.equal(normalizeExercise(FREE, { full: false }).instructions, undefined);
});

test('paid-host record: best media sizes, overview, types and difficulty', () => {
  const e = normalizeExercise(PAID);
  assert.equal(e.name, 'Lever Pec Deck Fly'); // mixed case is left alone
  assert.equal(e.gifUrl, PAID.gifUrls['720p']);
  assert.equal(e.thumbUrl, PAID.gifUrls['360p']);
  assert.equal(e.imageUrl, PAID.imageUrls['720p']);
  assert.equal(e.equipment, 'machine');
  assert.deepEqual([e.difficulty, e.overview, e.exerciseTypes, e.relatedIds], ['intermediate', PAID.overview, ['strength'], ['edb_1', 'edb_2']]);
});

test('unsafe or relative media links are dropped; junk records are skipped', () => {
  const e = normalizeExercise({ ...FREE, gifUrl: 'javascript:alert(1)', gifUrls: { '720p': 'Lever-Pec-Deck-Fly-Chest.mp4' } });
  assert.equal(e.gifUrl, '');
  assert.equal(normalizeExercise({ ...FREE, gifUrl: 'http://static.exercisedb.dev/x.gif' }).gifUrl, '');
  assert.equal(normalizeExercise(null), null);
  assert.equal(normalizeExercise({ name: 'no id' }), null);
});

test('ExerciseDB words map onto the gym’s muscles, equipment and categories', () => {
  assert.equal(toGymMuscle(['latissimus dorsi'], ['back']), 'back');
  assert.equal(toGymMuscle(['quadriceps']), 'quads');
  assert.equal(toGymMuscle(['something new'], ['upper legs']), 'quads');
  assert.equal(toGymMuscle([], ['waist']), 'core');
  assert.equal(toGymMuscle([], []), 'full_body');
  assert.equal(toGymEquipment(['EZ bar']), 'barbell');
  assert.equal(toGymEquipment(['body weight']), 'bodyweight');
  assert.equal(toGymEquipment(['stationary bike']), 'cardio_machine');
  assert.equal(toGymEquipment(['medicine ball']), 'other');
  assert.equal(toGymCategory({ bodyParts: ['cardio'] }), 'cardio');
  assert.equal(toGymCategory({ name: 'Seated hamstring stretch' }), 'stretching');
  assert.equal(toGymCategory({ exerciseTypes: ['yoga'] }), 'mobility');
  assert.equal(displayName('  push   up '), 'Push up');
});

test('name matches come first within a page, otherwise ExerciseDB order is kept', () => {
  const items = ['EZ-Bar Standing French Press', 'barbell bench press', 'cable bench press', 'plank'].map((name) => ({ name }));
  assert.deepEqual(rankByName(items, 'bench press').map((i) => i.name), ['barbell bench press', 'cable bench press', 'EZ-Bar Standing French Press', 'plank']);
  assert.equal(rankByName(items, ''), items);
});

// ── Calls, cache and errors ────────────────────────────────────────────────

test('search sends ExerciseDB’s parameter names, caps the page at 25 and returns the cursor', async () => {
  const fetch = fakeFetch({ '/api/v1/exercises': { body: { success: true, meta: { total: 52, hasNextPage: true, nextCursor: 'abc' }, data: [FREE] } } });
  setExerciseDbFetch(fetch);
  const page = await searchExerciseDb({ q: 'bench', bodyPart: 'chest', muscle: 'pectorals', equipment: 'barbell', limit: 100, after: 'zz1' });
  assert.deepEqual(fetch.calls[0].params, { name: 'bench', bodyParts: 'chest', targetMuscles: 'pectorals', equipments: 'barbell', limit: '25', after: 'zz1' });
  assert.equal(page.total, 52);
  assert.equal(page.nextCursor, 'abc');
  assert.equal(page.items[0].name, 'Barbell bench press');
  assert.equal(page.items[0].instructions, undefined, 'lists leave out the long text');
});

test('identical requests are answered from the cache, and share one call while in flight', async () => {
  const fetch = fakeFetch({ '/api/v1/exercises/EIeI8Vf': { body: { success: true, data: FREE } } });
  setExerciseDbFetch(fetch);
  const [a, b] = await Promise.all([getExerciseDbExercise('EIeI8Vf'), getExerciseDbExercise('EIeI8Vf')]);
  await getExerciseDbExercise('EIeI8Vf');
  assert.equal(fetch.calls.length, 1);
  assert.deepEqual(a, b);
});

test('EXERCISEDB_CACHE_TTL_SECONDS=0 calls ExerciseDB every time', async () => {
  process.env.EXERCISEDB_CACHE_TTL_SECONDS = '0';
  const fetch = fakeFetch({ '/api/v1/exercises/EIeI8Vf': { body: { success: true, data: FREE } } });
  setExerciseDbFetch(fetch);
  await getExerciseDbExercise('EIeI8Vf');
  await getExerciseDbExercise('EIeI8Vf');
  assert.equal(fetch.calls.length, 2);
});

test('the RapidAPI key goes in headers, never in the URL', async () => {
  process.env.EXERCISEDB_RAPIDAPI_KEY = 'secret-key';
  const fetch = fakeFetch({ '/api/v1/exercises/edb_T5uXtLj': { body: { success: true, data: PAID } } });
  setExerciseDbFetch(fetch);
  await getExerciseDbExercise('edb_T5uXtLj');
  assert.equal(fetch.calls[0].headers['X-RapidAPI-Key'], 'secret-key');
  assert.equal(fetch.calls[0].headers['X-RapidAPI-Host'], 'edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com');
  assert.ok(!fetch.calls[0].search.includes('secret'));
});

test('429: a "busy, try again in N seconds" error, and no further calls during the cool-down', async () => {
  const fetch = fakeFetch({ '/api/v1/exercises': { status: 429, body: { status: 429, retry_after: 30 } } });
  setExerciseDbFetch(fetch);
  await assert.rejects(searchExerciseDb({ q: 'squat' }), (e) => e.statusCode === 503 && e.code === 'EXERCISEDB_BUSY' && e.details.retryAfter === 30 && e.expose === true && /30 seconds/.test(e.message));
  await assert.rejects(searchExerciseDb({ q: 'row' }), (e) => e.code === 'EXERCISEDB_BUSY');
  assert.equal(fetch.calls.length, 1, 'the second search did not reach ExerciseDB');
});

test('a stale answer (from before the media rotation) beats an error', async () => {
  process.env.EXERCISEDB_CACHE_TTL_SECONDS = '0.001';
  let down = false;
  const fetch = fakeFetch({ '/api/v1/exercises/EIeI8Vf': () => (down ? { status: 500, body: {} } : { body: { success: true, data: FREE } }) });
  setExerciseDbFetch(fetch);
  await getExerciseDbExercise('EIeI8Vf');
  await new Promise((r) => setTimeout(r, 5));
  down = true;
  const again = await getExerciseDbExercise('EIeI8Vf');
  assert.equal(fetch.calls.length, 2);
  assert.equal(again.name, 'Barbell bench press');
});

test('errors in plain words: missing exercise, refused key, unreachable, malformed', async () => {
  setExerciseDbFetch(fakeFetch({}));
  await assert.rejects(getExerciseDbExercise('nope123'), (e) => e.statusCode === 404 && e.code === 'EXERCISE_NOT_FOUND');
  resetExerciseDbCache();
  setExerciseDbFetch(fakeFetch({ '/api/v1/exercises/x12': { status: 403, body: { message: 'You are not subscribed' } } }));
  await assert.rejects(getExerciseDbExercise('x12'), (e) => e.statusCode === 502 && e.code === 'EXERCISEDB_AUTH' && e.expose);
  resetExerciseDbCache();
  setExerciseDbFetch(fakeFetch({ '/api/v1/exercises/x12': { throw: Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }) } }));
  await assert.rejects(getExerciseDbExercise('x12'), (e) => e.code === 'EXERCISEDB_UNAVAILABLE' && e.statusCode === 502);
  resetExerciseDbCache();
  setExerciseDbFetch(fakeFetch({ '/api/v1/exercises': { body: { success: false } } }));
  await assert.rejects(searchExerciseDb({}), (e) => e.code === 'EXERCISEDB_UNAVAILABLE');
});

test('filters: exercise types are optional (404 on the free host), other lists sorted', async () => {
  setExerciseDbFetch(
    fakeFetch({
      '/api/v1/bodyparts': { body: { success: true, data: [{ name: 'waist' }, { name: 'chest' }] } },
      '/api/v1/muscles': { body: { success: true, data: [{ name: 'pectorals' }] } },
      '/api/v1/equipments': { body: { success: true, data: [{ name: 'dumbbell' }, { name: 'barbell' }] } },
    })
  );
  const f = await exerciseDbFilters();
  assert.deepEqual(f, { bodyParts: ['chest', 'waist'], targetMuscles: ['pectorals'], equipments: ['barbell', 'dumbbell'], exerciseTypes: [], unavailable: false, tier: 'free' });
});

test('filters: one list failing still returns the others; all failing is an error', async () => {
  setExerciseDbFetch(
    fakeFetch({
      '/api/v1/bodyparts': { body: { success: true, data: [{ name: 'chest' }] } },
      '/api/v1/muscles': { status: 500, body: {} },
      '/api/v1/equipments': { body: { success: true, data: [{ name: 'cable' }] } },
    })
  );
  const f = await exerciseDbFilters();
  assert.equal(f.unavailable, true);
  assert.deepEqual([f.bodyParts, f.targetMuscles, f.equipments], [['chest'], [], ['cable']]);
  resetExerciseDbCache();
  setExerciseDbFetch(fakeFetch({ '/api/v1/bodyparts': { status: 500, body: {} }, '/api/v1/muscles': { status: 500, body: {} }, '/api/v1/equipments': { status: 500, body: {} } }));
  await assert.rejects(exerciseDbFilters(), (e) => e.code === 'EXERCISEDB_UNAVAILABLE');
});

// ── Schedule rules ─────────────────────────────────────────────────────────

test('the gym week runs Monday to Sunday in gym time', () => {
  // Wednesday 8 Oct 2026, 08:00 IST.
  assert.deepEqual(scheduleWindows(new Date('2026-10-08T02:30:00Z')), { todayKey: '2026-10-08', weekStartKey: '2026-10-05', weekEndKey: '2026-10-11', overdueFromKey: '2026-10-01' });
  // Sunday 11 Oct, 23:30 IST: still the same week.
  assert.equal(scheduleWindows(new Date('2026-10-11T18:00:00Z')).weekEndKey, '2026-10-11');
  // Monday 12 Oct, 00:30 IST (still Sunday in UTC): a new week.
  assert.equal(scheduleWindows(new Date('2026-10-11T19:00:00Z')).weekStartKey, '2026-10-12');
});

test('state of an assignment as of today', () => {
  const t = '2026-10-08';
  assert.equal(assignmentState({ status: 'completed', dayKey: '2026-10-01' }, t), 'done');
  assert.equal(assignmentState({ status: 'cancelled', dayKey: '2026-10-09' }, t), 'cancelled');
  assert.equal(assignmentState({ status: 'assigned', dayKey: '2026-10-07' }, t), 'missed');
  assert.equal(assignmentState({ status: 'assigned', dayKey: t }, t), 'today');
  assert.equal(assignmentState({ status: 'assigned', dayKey: '2026-10-09' }, t), 'upcoming');
});

test('completion rate counts only exercises already due', () => {
  assert.deepEqual(summarize([{ total: 10, done: 3, missed: 1 }, { total: 5, done: 1, missed: 0 }], 4), { total: 15, done: 4, missed: 1, todo: 10, members: 4, completionRate: 80 });
  assert.equal(summarize([{ total: 3, done: 0, missed: 0 }], 1).completionRate, null);
});
