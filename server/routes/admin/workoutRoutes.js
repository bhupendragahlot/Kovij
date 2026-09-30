import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import {
  assignPlanSchema,
  endAssignmentSchema,
  listPlansQuery,
  logSchema,
  memberExerciseParams,
  memberParam,
  pageQuery,
  planPatchSchema,
  planSchema,
  rosterQuery,
  updateAssignmentSchema,
} from '../../validators/workout.schema.js';
import * as workouts from '../../controllers/workoutController.js';

/**
 * OWNER: trainers, workouts & exercise library module. Mounted at /api/admin/workouts.
 * Plans, what each member is doing, and logged sessions: admin, manager and trainer roles.
 * Fixed paths (/members, /assignments, /logs) are declared before /:id.
 */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
const byMember = validate(memberParam, 'params');
router.use(adminAuth, requirePermission('workouts.manage'));

// Members and their sessions
router.get('/members', validate(rosterQuery, 'query'), workouts.roster);
router.get('/members/:memberId', byMember, workouts.member);
router.get('/members/:memberId/logs', byMember, validate(pageQuery, 'query'), workouts.memberLogs);
router.post('/members/:memberId/logs', byMember, validate(logSchema), workouts.logSession);
router.get('/members/:memberId/progress', byMember, workouts.progress);
router.get('/members/:memberId/progress/:exerciseId', validate(memberExerciseParams, 'params'), workouts.progressForExercise);
router.patch('/assignments/:id', byId, validate(updateAssignmentSchema), workouts.updateMemberPlan);
router.post('/assignments/:id/end', byId, validate(endAssignmentSchema), workouts.endMemberPlan);
router.delete('/logs/:id', byId, workouts.removeLog);

// Plan templates
router.get('/', validate(listPlansQuery, 'query'), workouts.list);
router.post('/', validate(planSchema), idempotent({ required: false }), workouts.create);
router.get('/:id', byId, workouts.get);
router.patch('/:id', byId, validate(planPatchSchema), workouts.update);
router.delete('/:id', byId, workouts.remove);
router.post('/:id/duplicate', byId, idempotent({ required: false }), workouts.duplicate);
// Gives the plan to members and messages them: a retry must never do it twice.
router.post('/:id/assign', byId, validate(assignPlanSchema), idempotent(), workouts.assign);

export default router;
