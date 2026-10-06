import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import {
  assignExercisesSchema,
  completeExerciseSchema,
  historyQuery,
  memberParam,
  overviewQuery,
  updateExerciseAssignmentSchema,
} from '../../validators/exerciseAssignment.schema.js';
import * as assignments from '../../controllers/exerciseAssignmentController.js';

/**
 * OWNER: trainers, workouts & exercise library module. Mounted at /api/admin/exercise-assignments.
 * ExerciseDB exercises scheduled for members. Admins and managers work with every member;
 * trainers change only their own members' exercises (enforced in exerciseAssignmentService).
 */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
const byMember = validate(memberParam, 'params');
router.use(adminAuth, requirePermission('workouts.manage'));

router.get('/', validate(overviewQuery, 'query'), assignments.overview);
router.get('/members/:memberId', byMember, assignments.memberSchedule);
router.get('/members/:memberId/history', byMember, validate(historyQuery, 'query'), assignments.memberHistory);
// Schedules exercises and messages the member: a retry must never do it twice.
router.post('/members/:memberId', byMember, validate(assignExercisesSchema), idempotent(), assignments.assign);
router.patch('/:id', byId, validate(updateExerciseAssignmentSchema), assignments.update);
router.post('/:id/cancel', byId, assignments.cancel);
router.post('/:id/complete', byId, validate(completeExerciseSchema), assignments.staffComplete);
router.post('/:id/reopen', byId, assignments.staffReopen);

export default router;
