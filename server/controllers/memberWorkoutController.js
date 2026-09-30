import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assignmentHistory,
  exerciseProgress,
  getMemberLog,
  listLogs,
  memberPlan,
  progressOverview,
  saveLog,
} from '../services/training/workoutService.js';

/** Member app endpoints (/api/member/workouts). The member is always the one in the token. */
const me = (req) => req.member.memberId;

/** GET /api/member/workouts — current plan and today's suggested day. */
export const current = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberPlan(me(req))) });
});

/** GET /api/member/workouts/today */
export const today = asyncHandler(async (req, res) => {
  const { plan, today: t } = await memberPlan(me(req));
  res.json({ success: true, planName: plan?.name || null, assignmentId: plan?._id || null, today: t });
});

/** GET /api/member/workouts/plans — every plan the member has had, newest first. */
export const plans = asyncHandler(async (req, res) => {
  res.json({ success: true, items: await assignmentHistory(me(req)) });
});

/** GET /api/member/workouts/logs */
export const logs = asyncHandler(async (req, res) => {
  const result = await listLogs(me(req), req.validated.query);
  // Members see whether they or the gym logged a session, not which staff login did.
  res.json({ success: true, ...result, items: result.items.map(({ loggedByName, ...l }) => l) });
});

/** GET /api/member/workouts/logs/:id */
export const log = asyncHandler(async (req, res) => {
  const { loggedByUserId, ...item } = await getMemberLog(me(req), req.params.id);
  res.json({ success: true, log: item });
});

/** POST /api/member/workouts/logs — create or update the session for that day and plan day. */
export const saveSession = asyncHandler(async (req, res) => {
  const { log: saved, created } = await saveLog(me(req), req.validated.body, { kind: 'member' });
  const { loggedByUserId, ...item } = saved;
  res.status(created ? 201 : 200).json({ success: true, log: item, created });
});

/** GET /api/member/workouts/progress */
export const progress = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await progressOverview(me(req))) });
});

/** GET /api/member/workouts/progress/:exerciseId */
export const progressForExercise = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await exerciseProgress(me(req), req.params.exerciseId)) });
});
