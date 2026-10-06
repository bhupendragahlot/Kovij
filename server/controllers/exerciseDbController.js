import { asyncHandler } from '../utils/asyncHandler.js';
import { exerciseDbFilters, getExerciseDbExercise, searchExerciseDb } from '../services/training/exerciseDb.js';

/**
 * Browsing ExerciseDB, for staff (/api/admin/exercisedb) and members (/api/member/exercises/library).
 * Read-only and the same for both; the server holds any API key and the cache.
 */

/** GET …/filters — body parts, target muscles, equipment and (paid host only) exercise types. */
export const filters = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await exerciseDbFilters()) });
});

/** GET … — one page of matches; pass `nextCursor` back as `after` for the next page. */
export const search = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await searchExerciseDb(req.validated.query)) });
});

/** GET …/:exerciseDbId — instructions, muscles, equipment and media. */
export const detail = asyncHandler(async (req, res) => {
  res.json({ success: true, exercise: await getExerciseDbExercise(req.validated.params.exerciseDbId) });
});
