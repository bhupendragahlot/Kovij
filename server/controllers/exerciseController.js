import Exercise from '../models/Exercise.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { createExercise, exerciseUsage, listExercises, removeExercise, updateExercise } from '../services/training/exerciseService.js';

/** GET /api/admin/exercises — seeds the built-in library on first read. */
export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listExercises(req.validated.query)) });
});

/** POST /api/admin/exercises */
export const create = asyncHandler(async (req, res) => {
  const exercise = await createExercise(req.validated.body, req.staffUser);
  res.status(201).json({ success: true, exercise });
});

/** PATCH /api/admin/exercises/:id — `archived: false` restores. */
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, exercise: await updateExercise(req.params.id, req.validated.body) });
});

/** GET /api/admin/exercises/:id/usage */
export const usage = asyncHandler(async (req, res) => {
  if (!(await Exercise.exists({ _id: req.params.id }))) throw new AppError('Exercise not found', 404, 'NOT_FOUND');
  res.json({ success: true, usage: await exerciseUsage(req.params.id) });
});

/** DELETE /api/admin/exercises/:id — deletes an unused gym exercise, archives anything else. */
export const remove = asyncHandler(async (req, res) => {
  const result = await removeExercise(req.params.id);
  res.json({
    success: true,
    ...result,
    message: result.deleted ? 'Exercise deleted' : 'Exercise archived. Plans and history that use it keep working.',
  });
});
