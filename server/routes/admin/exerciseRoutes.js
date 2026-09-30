import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import { exercisePatchSchema, exerciseSchema, listExercisesQuery } from '../../validators/exercise.schema.js';
import { create, list, remove, update, usage } from '../../controllers/exerciseController.js';

/** OWNER: trainers, workouts & exercise library module. Mounted at /api/admin/exercises. */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
router.use(adminAuth, requirePermission('workouts.manage'));

router.get('/', validate(listExercisesQuery, 'query'), list);
router.post('/', validate(exerciseSchema), idempotent({ required: false }), create);
router.patch('/:id', byId, validate(exercisePatchSchema), update);
router.get('/:id/usage', byId, usage);
router.delete('/:id', byId, remove);

export default router;
