import { asyncHandler } from '../utils/asyncHandler.js';
import {
  addExtraItem,
  assignDiet,
  createPlan,
  deletePlan,
  dietOverview,
  duplicatePlan,
  getDay,
  getPlan,
  listAssignments,
  listPlans,
  nutritionHistory,
  removeExtraItem,
  setMealEaten,
  setPlanArchived,
  setWater,
  stopDiet,
  updatePlan,
} from '../services/dietService.js';

/**
 * Diet plans (staff) and a member's diet and daily log. Member-scoped handlers read
 * `req.subject.memberId` (set by loadMemberParam for staff, loadSelf for the member app), so the
 * same handler serves /api/admin/diets/members/:memberId/… and /api/member/diet/….
 */

const staffOf = (req) => ({ id: req.staffUser.id, name: req.staffUser.name, role: req.staffUser.role });

// ── Templates ───────────────────────────────────────────────────────────────

/** GET /api/admin/diets */
export const listDietPlans = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listPlans(req.validated.query)) });
});

/** GET /api/admin/diets/:id */
export const getDietPlan = asyncHandler(async (req, res) => {
  res.json({ success: true, plan: await getPlan(req.params.id) });
});

/** POST /api/admin/diets */
export const createDietPlan = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, plan: await createPlan(req.validated.body, staffOf(req)) });
});

/** PUT /api/admin/diets/:id — saves the whole plan (details, targets, meals). */
export const updateDietPlan = asyncHandler(async (req, res) => {
  res.json({ success: true, plan: await updatePlan(req.params.id, req.validated.body, staffOf(req)) });
});

/** PATCH /api/admin/diets/:id — { archived } */
export const archiveDietPlan = asyncHandler(async (req, res) => {
  res.json({ success: true, plan: await setPlanArchived(req.params.id, req.validated.body.archived, staffOf(req)) });
});

/** POST /api/admin/diets/:id/duplicate */
export const duplicateDietPlan = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, plan: await duplicatePlan(req.params.id, staffOf(req)) });
});

/** DELETE /api/admin/diets/:id */
export const deleteDietPlan = asyncHandler(async (req, res) => {
  await deletePlan(req.params.id);
  res.json({ success: true });
});

// ── A member's plan ─────────────────────────────────────────────────────────

/** POST …/members/:memberId/assign — idempotent. */
export const assignDietPlan = asyncHandler(async (req, res) => {
  const { planId, startDay, note } = req.validated.body;
  const result = await assignDiet({
    memberId: req.subject.memberId,
    planId,
    startDay,
    note,
    staff: staffOf(req),
    idempotencyKey: req.idempotencyKey,
  });
  res.status(result.replayed ? 200 : 201).json({ success: true, ...result });
});

/** POST …/members/:memberId/stop */
export const stopDietPlan = asyncHandler(async (req, res) => {
  await stopDiet({ memberId: req.subject.memberId, staff: staffOf(req) });
  res.json({ success: true, ...(await dietOverview(req.subject.memberId)) });
});

/** GET current plan, upcoming plan, past plans and today's log. */
export const getDietOverview = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await dietOverview(req.subject.memberId)) });
});

/** GET every plan the member has had, newest first. */
export const getDietAssignments = asyncHandler(async (req, res) => {
  res.json({ success: true, plans: await listAssignments(req.subject.memberId) });
});

/** GET daily totals vs targets for the last `days` days. */
export const getNutritionHistory = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await nutritionHistory(req.subject.memberId, { days: req.validated.query.days })) });
});

// ── The daily log ───────────────────────────────────────────────────────────

/** GET …/days/:day */
export const getDietDay = asyncHandler(async (req, res) => {
  res.json({ success: true, day: await getDay(req.subject.memberId, req.validated.params.day) });
});

/** PUT …/days/:day/meals/:mealId — { eaten } */
export const tickMeal = asyncHandler(async (req, res) => {
  const { day, mealId } = req.validated.params;
  res.json({ success: true, day: await setMealEaten({ memberId: req.subject.memberId, day, mealId, eaten: req.validated.body.eaten }) });
});

/** POST …/days/:day/items — idempotent. */
export const addExtra = asyncHandler(async (req, res) => {
  const day = await addExtraItem({ memberId: req.subject.memberId, day: req.validated.params.day, item: req.validated.body, actor: req.actor });
  res.status(201).json({ success: true, day });
});

/** DELETE …/days/:day/items/:itemId */
export const removeExtra = asyncHandler(async (req, res) => {
  const { day, itemId } = req.validated.params;
  res.json({ success: true, day: await removeExtraItem({ memberId: req.subject.memberId, day, itemId }) });
});

/** PUT …/days/:day/water — { glasses } (the new count, so a retry sets the same value). */
export const setWaterGlasses = asyncHandler(async (req, res) => {
  res.json({ success: true, day: await setWater({ memberId: req.subject.memberId, day: req.validated.params.day, glasses: req.validated.body.glasses }) });
});
