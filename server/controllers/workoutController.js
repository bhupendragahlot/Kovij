import { asyncHandler } from '../utils/asyncHandler.js';
import { coachingRoster, trainerForUser } from '../services/training/trainerService.js';
import {
  assignPlan,
  createPlan,
  deleteLog,
  duplicatePlan,
  endAssignment,
  exerciseProgress,
  getPlan,
  listLogs,
  listPlans,
  memberOverview,
  progressOverview,
  removePlan,
  saveLog,
  updateAssignment,
  updatePlan,
} from '../services/training/workoutService.js';

const staffActor = (req) => ({ id: req.staffUser.id, name: req.staffUser.name, role: req.staffUser.role });

// ── Templates ──────────────────────────────────────────────────────────────

/** GET /api/admin/workouts */
export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listPlans(req.validated.query)) });
});

/** GET /api/admin/workouts/:id */
export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, plan: await getPlan(req.params.id) });
});

/** POST /api/admin/workouts */
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, plan: await createPlan(req.validated.body, staffActor(req)) });
});

/** PATCH /api/admin/workouts/:id — `archived: false` restores an archived plan. */
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, plan: await updatePlan(req.params.id, req.validated.body, staffActor(req)) });
});

/** POST /api/admin/workouts/:id/duplicate */
export const duplicate = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, plan: await duplicatePlan(req.params.id, staffActor(req)) });
});

/** DELETE /api/admin/workouts/:id — deletes a never-used plan, archives one members have had. */
export const remove = asyncHandler(async (req, res) => {
  const result = await removePlan(req.params.id);
  res.json({ success: true, ...result, message: result.deleted ? `${result.name} deleted` : `${result.name} archived` });
});

/** POST /api/admin/workouts/:id/assign (Idempotency-Key required) */
export const assign = asyncHandler(async (req, res) => {
  const result = await assignPlan(req.params.id, req.validated.body, staffActor(req), req.idempotencyKey);
  res.status(201).json({ success: true, ...result });
});

// ── Members ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/workouts/members — coaching roster. `who=mine` lists the signed-in trainer's
 * members; if the login isn't linked to a trainer profile, `linked: false` explains the empty list.
 */
export const roster = asyncHandler(async (req, res) => {
  const { who, plan, q, page, limit } = req.validated.query;
  let trainerId;
  let linked;
  if (who === 'mine') {
    const own = await trainerForUser(req.staffUser.id);
    linked = Boolean(own);
    if (!own) {
      return res.json({ success: true, linked, trainer: null, items: [], total: 0, page, limit, counts: { all: 0, on_plan: 0, no_plan: 0 } });
    }
    trainerId = String(own._id);
    const result = await coachingRoster({ trainerId, plan, q, page, limit });
    return res.json({ success: true, linked, trainer: { _id: own._id, name: own.name }, ...result });
  }
  if (who !== 'all') trainerId = who;
  res.json({ success: true, ...(await coachingRoster({ trainerId, plan, q, page, limit })) });
});

/** GET /api/admin/workouts/members/:memberId */
export const member = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberOverview(req.params.memberId)) });
});

/** GET /api/admin/workouts/members/:memberId/logs */
export const memberLogs = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listLogs(req.params.memberId, req.validated.query)) });
});

/** POST /api/admin/workouts/members/:memberId/logs — quick log of a session done at the gym. */
export const logSession = asyncHandler(async (req, res) => {
  const { log, created } = await saveLog(req.params.memberId, req.validated.body, { kind: 'staff', userId: req.staffUser.id });
  res.status(created ? 201 : 200).json({ success: true, log, created });
});

/** DELETE /api/admin/workouts/logs/:id */
export const removeLog = asyncHandler(async (req, res) => {
  await deleteLog(req.params.id);
  res.json({ success: true, message: 'Session deleted' });
});

/** GET /api/admin/workouts/members/:memberId/progress */
export const progress = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await progressOverview(req.params.memberId)) });
});

/** GET /api/admin/workouts/members/:memberId/progress/:exerciseId */
export const progressForExercise = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await exerciseProgress(req.params.memberId, req.params.exerciseId)) });
});

// ── A member's plan ────────────────────────────────────────────────────────

/** PATCH /api/admin/workouts/assignments/:id — change this member's copy only. */
export const updateMemberPlan = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await updateAssignment(req.params.id, req.validated.body, staffActor(req)) });
});

/** POST /api/admin/workouts/assignments/:id/end */
export const endMemberPlan = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await endAssignment(req.params.id, req.validated.body, staffActor(req)) });
});
