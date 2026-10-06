/**
 * Stand-in for ExerciseDB's free host (oss.exercisedb.dev), so the e2e suite never calls the real
 * API. Same paths, query parameters and response shapes as the real one (checked Oct 2026):
 * cursor paging, a loose "name" filter, filter lists, and 404 for /exercisetypes.
 *
 * Control (for flows): POST /__busy?n=2&retry=1 makes the next n calls answer 429; GET /__calls
 * counts calls per path since the last POST /__reset.
 */
import http from 'node:http';

const media = (id) => `https://static.exercisedb.dev/media/${id}.gif`;
const ex = (exerciseId, name, bodyParts, targetMuscles, equipments, secondaryMuscles = []) => ({
  exerciseId,
  name,
  gifUrl: media(exerciseId),
  bodyParts,
  equipments,
  targetMuscles,
  secondaryMuscles,
  instructions: [`Step:1 Set up for the ${name}.`, 'Step:2 Move with control.', 'Step:3 Repeat for the reps.'],
});

export const STUB_EXERCISES = [
  ex('EIeI8Vf', 'barbell bench press', ['chest'], ['pectorals'], ['barbell'], ['triceps', 'deltoids']),
  ex('SpYC0Kp', 'dumbbell bench press', ['chest'], ['pectorals'], ['dumbbell'], ['triceps']),
  ex('1cTf2Ux', 'EZ-Bar Standing French Press', ['upper arms'], ['triceps'], ['EZ bar'], ['deltoids']),
  ex('qXTaZnJ', 'barbell full squat', ['upper legs'], ['glutes'], ['barbell'], ['quadriceps', 'hamstrings']),
  ex('4IKbhHV', 'jump squat', ['upper legs'], ['glutes'], ['body weight'], ['quadriceps']),
  ex('0IgNjSM', 'dumbbell standing reverse curl', ['upper arms'], ['biceps'], ['dumbbell'], ['forearms']),
  ex('03lzqwk', 'assisted hanging knee raise', ['waist'], ['abdominals'], ['assisted'], ['hip flexors']),
  ex('rjiM4L3', 'stationary bike walk', ['cardio'], ['cardiovascular system'], ['stationary bike'], ['quadriceps']),
].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId));

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const has = (list, csv) => !csv || csv.split(',').some((v) => list.some((x) => x.toLowerCase() === v.trim().toLowerCase()));
const nameMatch = (name, q) => !q || q.toLowerCase().split(/\s+/).some((w) => name.toLowerCase().includes(w));

export async function startExerciseDbStub() {
  let busy = { n: 0, retry: 1 };
  let calls = {};
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://stub');
    const p = url.pathname;
    if (p === '/__busy') {
      busy = { n: Number(url.searchParams.get('n')) || 1, retry: Number(url.searchParams.get('retry')) || 1 };
      return json(res, 200, { ok: true });
    }
    if (p === '/__reset') {
      busy = { n: 0, retry: 1 };
      calls = {};
      return json(res, 200, { ok: true });
    }
    if (p === '/__calls') return json(res, 200, calls);
    calls[p] = (calls[p] || 0) + 1;
    if (busy.n > 0) {
      busy.n -= 1;
      return json(res, 429, { title: 'Error 1015: You are being rate limited', status: 429, retry_after: busy.retry, retryable: true });
    }
    const names = (key) => [...new Set(STUB_EXERCISES.flatMap((e) => e[key]))].map((name) => ({ name }));
    if (p === '/api/v1/bodyparts') return json(res, 200, { success: true, data: names('bodyParts') });
    if (p === '/api/v1/muscles') return json(res, 200, { success: true, data: names('targetMuscles') });
    if (p === '/api/v1/equipments') return json(res, 200, { success: true, data: names('equipments') });
    if (p === '/api/v1/exercises') {
      const q = Object.fromEntries(url.searchParams);
      const limit = Math.min(25, Math.max(1, Number(q.limit) || 10));
      const all = STUB_EXERCISES.filter(
        (e) => nameMatch(e.name, q.name) && has(e.bodyParts, q.bodyParts) && has(e.targetMuscles, q.targetMuscles) && has(e.equipments, q.equipments)
      );
      const start = q.after ? all.findIndex((e) => e.exerciseId === q.after) + 1 : 0;
      const data = all.slice(start, start + limit);
      const hasNextPage = start + limit < all.length;
      return json(res, 200, {
        success: true,
        meta: { total: all.length, hasNextPage, hasPreviousPage: start > 0, nextCursor: hasNextPage ? data[data.length - 1].exerciseId : undefined, previousCursor: start > 0 ? data[0]?.exerciseId : undefined },
        data,
      });
    }
    const one = /^\/api\/v1\/exercises\/([^/]+)$/.exec(p);
    if (one) {
      const found = STUB_EXERCISES.find((e) => e.exerciseId === decodeURIComponent(one[1]));
      return found ? json(res, 200, { success: true, data: found }) : json(res, 404, { error: { code: 'NOT_FOUND', message: `Exercise with ID ${one[1]} not found.` } });
    }
    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'The requested resource was not found' } });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
