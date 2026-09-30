import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import {
  assignDietSchema,
  dayParams,
  dietPlanPatchSchema,
  dietPlanSchema,
  extraItemSchema,
  historyQuery,
  itemParams,
  listDietPlansQuery,
  mealParams,
  mealTickSchema,
  waterSchema,
} from '../../validators/wellness.schema.js';
import {
  addExtra,
  archiveDietPlan,
  assignDietPlan,
  createDietPlan,
  deleteDietPlan,
  duplicateDietPlan,
  getDietAssignments,
  getDietDay,
  getDietOverview,
  getDietPlan,
  getNutritionHistory,
  listDietPlans,
  removeExtra,
  setWaterGlasses,
  stopDietPlan,
  tickMeal,
  updateDietPlan,
} from '../../controllers/dietController.js';
import { loadMemberParam } from '../../controllers/wellnessAccess.js';

/**
 * OWNER: wellness module (diet, progress & notes). Mounted at /api/admin/diets.
 *
 *   Diet plan templates                 diets.manage
 *   A member's diet and log (read)      members.health.view
 *   Giving, stopping, logging for them  diets.manage
 *
 * The permission is checked before the member is looked up, so a role without it can't probe
 * which member ids exist.
 */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
const manage = requirePermission('diets.manage');
const view = requirePermission('members.health.view');
router.use(adminAuth);

// One member's diet. Registered before "/:id" so "members" is never read as a plan id.
const M = '/members/:memberId';
router.get(M, view, loadMemberParam, getDietOverview);
router.get(`${M}/plans`, view, loadMemberParam, getDietAssignments);
router.get(`${M}/history`, view, loadMemberParam, validate(historyQuery, 'query'), getNutritionHistory);
router.post(`${M}/assign`, manage, view, loadMemberParam, validate(assignDietSchema), idempotent(), assignDietPlan);
router.post(`${M}/stop`, manage, view, loadMemberParam, stopDietPlan);
router.get(`${M}/days/:day`, view, loadMemberParam, validate(dayParams, 'params'), getDietDay);
router.put(`${M}/days/:day/meals/:mealId`, manage, view, loadMemberParam, validate(mealParams, 'params'), validate(mealTickSchema), tickMeal);
router.post(`${M}/days/:day/items`, manage, view, loadMemberParam, validate(dayParams, 'params'), validate(extraItemSchema), idempotent(), addExtra);
router.delete(`${M}/days/:day/items/:itemId`, manage, view, loadMemberParam, validate(itemParams, 'params'), removeExtra);
router.put(`${M}/days/:day/water`, manage, view, loadMemberParam, validate(dayParams, 'params'), validate(waterSchema), setWaterGlasses);

// Templates
router.get('/', manage, validate(listDietPlansQuery, 'query'), listDietPlans);
router.post('/', manage, validate(dietPlanSchema), idempotent(), createDietPlan);
router.get('/:id', manage, byId, getDietPlan);
router.put('/:id', manage, byId, validate(dietPlanSchema), updateDietPlan);
router.patch('/:id', manage, byId, validate(dietPlanPatchSchema), archiveDietPlan);
router.post('/:id/duplicate', manage, byId, idempotent(), duplicateDietPlan);
router.delete('/:id', manage, byId, deleteDietPlan);

export default router;
