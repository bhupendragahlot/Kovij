import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { exerciseDbLimiter } from '../../middleware/rateLimiter.js';
import { exerciseDbIdParam, exerciseDbSearchQuery } from '../../validators/exerciseAssignment.schema.js';
import { detail, filters, search } from '../../controllers/exerciseDbController.js';

/**
 * OWNER: trainers, workouts & exercise library module. Mounted at /api/admin/exercisedb.
 * Searching ExerciseDB (through the server, see services/training/exerciseDb.js) for coaches.
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('workouts.manage'), exerciseDbLimiter);

router.get('/filters', filters);
router.get('/exercises', validate(exerciseDbSearchQuery, 'query'), search);
router.get('/exercises/:exerciseDbId', validate(exerciseDbIdParam, 'params'), detail);

export default router;
