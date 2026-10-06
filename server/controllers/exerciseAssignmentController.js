import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assignExercises,
  cancelExerciseAssignment,
  completeExerciseAssignment,
  exerciseAssignmentOverview,
  memberExerciseHistory,
  memberExerciseSchedule,
  reopenExerciseAssignment,
  staffMemberSchedule,
  updateExerciseAssignment,
} from '../services/training/exerciseAssignmentService.js';

const staffActor = (req) => ({ id: req.staffUser.id, name: req.staffUser.name, role: req.staffUser.role });
const asStaff = (req) => ({ kind: 'staff', actor: staffActor(req) });
const asMember = (req) => ({ kind: 'member', memberId: req.member.memberId });

// ── Staff (/api/admin/exercise-assignments) ────────────────────────────────

/** GET / — every member's scheduled exercises in a date range, with totals. Trainers see their members. */
export const overview = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await exerciseAssignmentOverview(req.validated.query, staffActor(req))) });
});

/** GET /members/:memberId — today, this week, later, and whether this login may change them. */
export const memberSchedule = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await staffMemberSchedule(req.params.memberId, staffActor(req))) });
});

/** GET /members/:memberId/history */
export const memberHistory = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberExerciseHistory(req.params.memberId, req.validated.query, { staff: true })) });
});

/** POST /members/:memberId (Idempotency-Key required) — schedule exercises and tell the member. */
export const assign = asyncHandler(async (req, res) => {
  const result = await assignExercises(req.params.memberId, req.validated.body, staffActor(req), req.idempotencyKey);
  res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
});

/** PATCH /:id — move to another day or change sets, reps, time, rest, weight or notes. */
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await updateExerciseAssignment(req.params.id, req.validated.body, staffActor(req)) });
});

/** POST /:id/cancel — take it off the member's list (kept for the record). */
export const cancel = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await cancelExerciseAssignment(req.params.id, staffActor(req)) });
});

/** POST /:id/complete — a trainer ticks it off for the member (e.g. done on the floor). */
export const staffComplete = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await completeExerciseAssignment(req.params.id, req.validated.body, asStaff(req)) });
});

/** POST /:id/reopen */
export const staffReopen = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await reopenExerciseAssignment(req.params.id, asStaff(req)) });
});

// ── Member (/api/member/exercises) ─────────────────────────────────────────

/** GET /schedule */
export const mySchedule = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberExerciseSchedule(req.member.memberId)) });
});

/** GET /history */
export const myHistory = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberExerciseHistory(req.member.memberId, req.validated.query)) });
});

/** POST /:id/complete — safe to repeat. */
export const complete = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await completeExerciseAssignment(req.params.id, req.validated.body, asMember(req)) });
});

/** POST /:id/reopen — undo a mistaken "done". */
export const reopen = asyncHandler(async (req, res) => {
  res.json({ success: true, assignment: await reopenExerciseAssignment(req.params.id, asMember(req)) });
});
