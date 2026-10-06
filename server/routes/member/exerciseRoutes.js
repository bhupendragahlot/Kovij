import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { exerciseDbLimiter } from '../../middleware/rateLimiter.js';
import { idParam } from '../../validators/common.js';
import { completeExerciseSchema, exerciseDbIdParam, exerciseDbSearchQuery, historyQuery } from '../../validators/exerciseAssignment.schema.js';
import { detail, filters, search } from '../../controllers/exerciseDbController.js';
import * as mine from '../../controllers/exerciseAssignmentController.js';

/**
 * OWNER: trainers, workouts & exercise library module. Mounted at /api/member/exercises.
 * Browse ExerciseDB, and the exercises a trainer scheduled for the member in the token.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/library/filters', exerciseDbLimiter, filters);
router.get('/library', exerciseDbLimiter, validate(exerciseDbSearchQuery, 'query'), search);
router.get('/library/:exerciseDbId', exerciseDbLimiter, validate(exerciseDbIdParam, 'params'), detail);

router.get('/schedule', mine.mySchedule);
router.get('/history', validate(historyQuery, 'query'), mine.myHistory);
router.post('/:id/complete', validate(idParam, 'params'), validate(completeExerciseSchema), mine.complete);
router.post('/:id/reopen', validate(idParam, 'params'), mine.reopen);

export default router;
