/**
 * ExerciseDB (github.com/ExerciseDB/exercisedb-api, docs at docs.ascendapi.com): the outside
 * exercise catalogue that trainers and members browse. Only the server talks to it, so an API
 * key never reaches a browser and every caller shares one cache.
 *
 * Hosts (same v1 paths and query parameters):
 *   free  https://oss.exercisedb.dev: no key, about 1,500 exercises with 180p GIFs, strict burst
 *         limits (Cloudflare answers 429 after roughly ten quick calls)
 *   paid  RapidAPI (set EXERCISEDB_RAPIDAPI_KEY): adds difficulty, exercise types, an overview and
 *         multi-resolution images and GIFs
 *
 * Endpoints used:
 *   GET /api/v1/exercises?name&bodyParts&targetMuscles&equipments&exerciseTypes&limit(≤25)&after
 *   GET /api/v1/exercises/{exerciseId}
 *   GET /api/v1/bodyparts | /muscles | /equipments | /exercisetypes (types: paid host only)
 *
 * Caching: answers are kept in memory for EXERCISEDB_CACHE_TTL_SECONDS (default 6 hours; 0 turns
 * caching off for plans that don't allow it), and never past Monday 00:00 UTC, when ExerciseDB
 * rotates its media links. Our database keeps only the stable exercise id and a short
 * name/muscle/equipment snapshot (for workout history); GIF and image links are fetched fresh.
 */
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../utils/logger.js';

const FREE_BASE = 'https://oss.exercisedb.dev';
const RAPIDAPI_BASE = 'https://edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com';
const TIMEOUT_MS = 8000;
const DEFAULT_TTL_SEC = 6 * 60 * 60;
const MAX_ENTRIES = 600;
/** ExerciseDB's own page-size limit. */
export const EXERCISEDB_PAGE_MAX = 25;

export function exerciseDbConfig(env = process.env) {
  const key = String(env.EXERCISEDB_RAPIDAPI_KEY || '').trim();
  const base = String(env.EXERCISEDB_BASE_URL || (key ? RAPIDAPI_BASE : FREE_BASE))
    .trim()
    .replace(/\/+$/, '');
  const raw = env.EXERCISEDB_CACHE_TTL_SECONDS;
  const ttlSec = raw === undefined || String(raw).trim() === '' ? DEFAULT_TTL_SEC : Math.max(0, Number(raw) || 0);
  return { base, key, ttlMs: ttlSec * 1000, tier: key ? 'rapidapi' : 'free' };
}

/** Next Monday 00:00 UTC (media links rotate then). */
export function nextMediaRotation(now = Date.now()) {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const daysAhead = (1 - d.getUTCDay() + 7) % 7 || 7;
  return midnight + daysAhead * 86_400_000;
}

// ── Mapping onto the gym's own vocabulary (services/training/constants.js) ───

const MUSCLE_MAP = {
  pectorals: 'chest',
  chest: 'chest',
  'serratus anterior': 'chest',
  'latissimus dorsi': 'back',
  lats: 'back',
  back: 'back',
  'upper back': 'back',
  'lower back': 'back',
  rhomboids: 'back',
  trapezius: 'back',
  traps: 'back',
  'erector spinae': 'back',
  spine: 'back',
  'levator scapulae': 'back',
  sternocleidomastoid: 'back',
  deltoids: 'shoulders',
  delts: 'shoulders',
  'rear deltoids': 'shoulders',
  'rotator cuff': 'shoulders',
  shoulders: 'shoulders',
  biceps: 'biceps',
  brachialis: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  'grip muscles': 'forearms',
  wrists: 'forearms',
  hands: 'forearms',
  abdominals: 'core',
  abs: 'core',
  core: 'core',
  obliques: 'core',
  'hip flexors': 'core',
  quadriceps: 'quads',
  quads: 'quads',
  adductors: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  abductors: 'glutes',
  calves: 'calves',
  soleus: 'calves',
  'tibialis anterior': 'calves',
  ankles: 'calves',
  'ankle stabilizers': 'calves',
  feet: 'calves',
  'cardiovascular system': 'full_body',
};

const BODY_PART_MAP = {
  chest: 'chest',
  back: 'back',
  neck: 'back',
  shoulders: 'shoulders',
  'lower arms': 'forearms',
  'upper legs': 'quads',
  'lower legs': 'calves',
  waist: 'core',
  cardio: 'full_body',
};

const EQUIPMENT_MAP = {
  barbell: 'barbell',
  'olympic barbell': 'barbell',
  'ez bar': 'barbell',
  'ez barbell': 'barbell',
  'trap bar': 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  'body weight': 'bodyweight',
  bodyweight: 'bodyweight',
  assisted: 'machine',
  'smith machine': 'machine',
  'leverage machine': 'machine',
  'sled machine': 'machine',
  kettlebell: 'kettlebell',
  band: 'band',
  'resistance band': 'band',
  'stationary bike': 'cardio_machine',
  'elliptical machine': 'cardio_machine',
  'stepmill machine': 'cardio_machine',
  'skierg machine': 'cardio_machine',
  'ski ergometer': 'cardio_machine',
  'upper body ergometer': 'cardio_machine',
};

const lower = (s) => String(s || '').trim().toLowerCase();

export const toGymMuscle = (targetMuscles = [], bodyParts = []) =>
  MUSCLE_MAP[lower(targetMuscles[0])] || BODY_PART_MAP[lower(bodyParts[0])] || targetMuscles.map(lower).map((m) => MUSCLE_MAP[m]).find(Boolean) || 'full_body';

export const toGymEquipment = (equipments = []) => EQUIPMENT_MAP[lower(equipments[0])] || 'other';

export function toGymCategory({ exerciseTypes = [], bodyParts = [], name = '' }) {
  const types = exerciseTypes.map(lower);
  if (types.includes('cardio') || bodyParts.map(lower).includes('cardio')) return 'cardio';
  if (types.includes('stretching') || /\bstretch/i.test(name)) return 'stretching';
  if (types.some((t) => t === 'mobility' || t === 'yoga')) return 'mobility';
  return 'strength';
}

// ── Normalising ExerciseDB records ─────────────────────────────────────────

const list = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);
/** Only absolute https links are passed on (never javascript:, data: or bare file names). */
const httpsUrl = (v) => (typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(v.trim()) ? v.trim() : '');
const bestOf = (obj, order) => (obj && typeof obj === 'object' ? order.map((k) => httpsUrl(obj[k])).find(Boolean) || '' : '');

/** "barbell bench press" → "Barbell bench press"; names already in mixed case are left alone. */
export function displayName(name) {
  const s = String(name || '').trim().replace(/\s+/g, ' ');
  return s && s === s.toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s;
}

/** "Step:1 Lie flat…" → "Lie flat…" */
const cleanStep = (step) => String(step || '').replace(/^\s*step\s*:?\s*\d+\s*[:.)-]?\s*/i, '').trim();

/**
 * One ExerciseDB record (free or paid shape, or the slim /search shape) in our format.
 * `full: false` leaves out the long text for list views.
 */
export function normalizeExercise(raw, { full = true } = {}) {
  if (!raw || typeof raw !== 'object' || !raw.exerciseId) return null;
  const bodyParts = list(raw.bodyParts);
  const targetMuscles = list(raw.targetMuscles);
  const secondaryMuscles = list(raw.secondaryMuscles);
  const equipments = list(raw.equipments);
  const exerciseTypes = list(raw.exerciseTypes);
  const name = displayName(raw.name);
  const gifUrl = httpsUrl(raw.gifUrl) || bestOf(raw.gifUrls, ['720p', '480p', '1080p', '360p']);
  const out = {
    id: String(raw.exerciseId),
    name,
    gifUrl,
    thumbUrl: bestOf(raw.gifUrls, ['360p', '480p']) || bestOf(raw.imageUrls, ['360p', '480p']) || gifUrl,
    bodyParts,
    targetMuscles,
    secondaryMuscles,
    equipments,
    exerciseTypes,
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty.trim() : '',
    // The gym's own words, so ExerciseDB moves sit beside the rest of the training data.
    primaryMuscle: toGymMuscle(targetMuscles, bodyParts),
    equipment: toGymEquipment(equipments),
    category: toGymCategory({ exerciseTypes, bodyParts, name }),
  };
  if (full) {
    out.instructions = list(raw.instructions).map(cleanStep).filter(Boolean);
    out.overview = typeof raw.overview === 'string' ? raw.overview.trim() : '';
    out.imageUrl = bestOf(raw.imageUrls, ['720p', '1080p', '480p', '360p']);
    out.relatedIds = list(raw.relatedExerciseIds).slice(0, 12);
  }
  return out;
}

/** Search words found in the name come first (ExerciseDB's name filter is loose and unordered). */
export function rankByName(items, q) {
  const words = lower(q).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  const score = (item) => {
    const n = lower(item.name);
    const hits = words.filter((w) => n.includes(w)).length;
    return (hits === words.length ? 2 : hits ? 1 : 0) + (n.startsWith(words[0]) ? 0.5 : 0);
  };
  return items
    .map((item, i) => ({ item, i, s: score(item) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.item);
}

// ── HTTP with errors in plain words ────────────────────────────────────────

let fetchImpl = (...args) => fetch(...args);

/** Tests swap in a fake fetch; call with no argument to restore the real one. */
export function setExerciseDbFetch(fn) {
  fetchImpl = fn || ((...args) => fetch(...args));
}

function upstreamError(message, status, code, details) {
  const err = new AppError(message, status, code, details);
  err.expose = true;
  return err;
}

const busyError = (retryAfter) =>
  upstreamError(`The exercise library is busy right now. Try again in ${retryAfter} seconds.`, 503, 'EXERCISEDB_BUSY', { retryAfter });
const unavailableError = () => upstreamError("Couldn't reach the exercise library. Try again in a minute.", 502, 'EXERCISEDB_UNAVAILABLE');

function retryAfterSeconds(res, body) {
  const fromHeader = Number(res.headers?.get?.('retry-after'));
  const fromBody = Number(body?.retry_after);
  const sec = Number.isFinite(fromHeader) && fromHeader > 0 ? fromHeader : Number.isFinite(fromBody) && fromBody > 0 ? fromBody : 30;
  return Math.min(300, Math.ceil(sec));
}

/** While ExerciseDB is rate limiting us, don't call it at all (cached answers still serve). */
let coolDownUntil = 0;

async function request(path, params, config) {
  const url = new URL(config.base + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { Accept: 'application/json' };
  if (config.key) {
    headers['X-RapidAPI-Key'] = config.key;
    headers['X-RapidAPI-Host'] = url.host;
  }
  let res;
  try {
    res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    logger.warn(`ExerciseDB unreachable: ${e?.cause?.code || e?.name || e?.message}`, { path });
    throw unavailableError();
  }
  const body = await res.json().catch(() => null);
  if (res.status === 429) {
    const retryAfter = retryAfterSeconds(res, body);
    coolDownUntil = Date.now() + retryAfter * 1000;
    logger.warn(`ExerciseDB rate limited us for ${retryAfter}s`, { path });
    throw busyError(retryAfter);
  }
  if (res.status === 404) throw new AppError('That exercise is not in the exercise library any more', 404, 'EXERCISE_NOT_FOUND');
  if (res.status === 401 || res.status === 403) {
    logger.warn(`ExerciseDB refused the request (${res.status}). Check EXERCISEDB_RAPIDAPI_KEY.`, { path });
    throw upstreamError('The exercise library refused our request. Ask the gym owner to check the ExerciseDB settings.', 502, 'EXERCISEDB_AUTH');
  }
  if (!res.ok || !body || body.success === false) {
    logger.warn(`ExerciseDB answered ${res.status}`, { path });
    throw unavailableError();
  }
  return body;
}

// ── Cache ──────────────────────────────────────────────────────────────────

/** key → { value, freshUntil, hardUntil }. hardUntil is the media rotation: past it, never serve. */
const cache = new Map();
const inflight = new Map();

function remember(key, value, config, now = Date.now()) {
  if (!config.ttlMs) return;
  const hardUntil = nextMediaRotation(now);
  cache.delete(key);
  cache.set(key, { value, freshUntil: Math.min(now + config.ttlMs, hardUntil), hardUntil });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export function resetExerciseDbCache() {
  cache.clear();
  inflight.clear();
  coolDownUntil = 0;
}

/**
 * GET with the cache: fresh answers are served without a call; identical calls in flight share
 * one request; if ExerciseDB is busy or down, a stale answer from before the media rotation is
 * better than an error.
 */
async function cachedGet(path, params = {}) {
  const config = exerciseDbConfig();
  const key = `${config.base}${path}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').sort()).toString()}`;
  const now = Date.now();
  const hit = cache.get(key);
  const usableStale = hit && now < hit.hardUntil ? hit : null;
  if (hit && now < hit.freshUntil) return hit.value;
  if (now < coolDownUntil) {
    if (usableStale) return usableStale.value;
    throw busyError(Math.ceil((coolDownUntil - now) / 1000));
  }
  if (inflight.has(key)) return inflight.get(key);
  const pending = request(path, params, config)
    .then((value) => {
      remember(key, value, config);
      return value;
    })
    .catch((err) => {
      if (usableStale && err.code !== 'EXERCISE_NOT_FOUND') return usableStale.value;
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

// ── Public API ─────────────────────────────────────────────────────────────

const names = (body) => [...new Set((Array.isArray(body?.data) ? body.data : []).map((d) => String(d?.name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/**
 * The values ExerciseDB filters by. A list that can't be fetched comes back empty (and
 * `unavailable` is set) so search still works without that filter.
 */
export async function exerciseDbFilters() {
  const [bodyParts, muscles, equipments, types] = await Promise.allSettled([
    cachedGet('/api/v1/bodyparts'),
    cachedGet('/api/v1/muscles'),
    cachedGet('/api/v1/equipments'),
    cachedGet('/api/v1/exercisetypes'),
  ]);
  const value = (r) => (r.status === 'fulfilled' ? names(r.value) : []);
  // Exercise types exist on the paid host only; the free host answers 404.
  const typeMissing = types.status === 'rejected' && types.reason?.code === 'EXERCISE_NOT_FOUND';
  const failed = [bodyParts, muscles, equipments, ...(typeMissing ? [] : [types])].filter((r) => r.status === 'rejected');
  if (failed.length === 4 || (typeMissing && failed.length === 3)) throw failed[0].reason;
  return {
    bodyParts: value(bodyParts),
    targetMuscles: value(muscles),
    equipments: value(equipments),
    exerciseTypes: value(types),
    unavailable: failed.length > 0,
    tier: exerciseDbConfig().tier,
  };
}

/**
 * One page of exercises. Filters are ExerciseDB's own values (from exerciseDbFilters); paging is
 * by cursor (`after` = the previous page's `nextCursor`).
 * @param {{ q?: string, bodyPart?: string, muscle?: string, equipment?: string, type?: string, after?: string, limit?: number }} opts
 */
export async function searchExerciseDb({ q, bodyPart, muscle, equipment, type, after, limit = 24 } = {}) {
  const body = await cachedGet('/api/v1/exercises', {
    name: q,
    bodyParts: bodyPart,
    targetMuscles: muscle,
    equipments: equipment,
    exerciseTypes: type,
    limit: Math.min(EXERCISEDB_PAGE_MAX, Math.max(1, Number(limit) || 24)),
    after,
  });
  if (!Array.isArray(body.data)) throw unavailableError();
  const items = body.data.map((raw) => normalizeExercise(raw, { full: false })).filter(Boolean);
  return {
    items: rankByName(items, q),
    total: Number(body.meta?.total) || items.length,
    nextCursor: body.meta?.hasNextPage && body.meta?.nextCursor ? String(body.meta.nextCursor) : null,
  };
}

/** One exercise with instructions and media. 404 (EXERCISE_NOT_FOUND) if ExerciseDB has no such id. */
export async function getExerciseDbExercise(id) {
  const body = await cachedGet(`/api/v1/exercises/${encodeURIComponent(id)}`);
  const exercise = normalizeExercise(body.data);
  if (!exercise) throw unavailableError();
  return exercise;
}

/** Several exercises by id (one cached call each; ExerciseDB has no batch lookup). */
export async function getExerciseDbExercises(ids) {
  const unique = [...new Set(ids.map(String))];
  const found = new Map();
  // One at a time: a burst of parallel calls is what trips the free host's rate limit.
  for (const id of unique) found.set(id, await getExerciseDbExercise(id));
  return found;
}
