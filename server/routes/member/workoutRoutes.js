import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { idParam } from '../../validators/common.js';
import { exerciseParam, logSchema, pageQuery } from '../../validators/workout.schema.js';
import * as mine from '../../controllers/memberWorkoutController.js';

/**
 * OWNER: trainers, workouts & exercise library module. Mounted at /api/member/workouts.
 * Everything is scoped to the member in the token.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/', mine.current);
router.get('/today', mine.today);
router.get('/plans', mine.plans);
router.get('/logs', validate(pageQuery, 'query'), mine.logs);
// Saving the same day and plan day again updates that session, so retries are safe.
router.post('/logs', validate(logSchema), mine.saveSession);
router.get('/logs/:id', validate(idParam, 'params'), mine.log);
router.get('/progress', mine.progress);
router.get('/progress/:exerciseId', validate(exerciseParam, 'params'), mine.progressForExercise);

export default router;
