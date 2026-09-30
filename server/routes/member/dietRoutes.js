import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { dayParams, extraItemSchema, historyQuery, itemParams, mealParams, mealTickSchema, waterSchema } from '../../validators/wellness.schema.js';
import {
  addExtra,
  getDietAssignments,
  getDietDay,
  getDietOverview,
  getNutritionHistory,
  removeExtra,
  setWaterGlasses,
  tickMeal,
} from '../../controllers/dietController.js';
import { loadSelf } from '../../controllers/wellnessAccess.js';

/**
 * OWNER: wellness module (diet, progress & notes). Mounted at /api/member/diet.
 * The signed-in member's own diet plan and daily log; there is no way to name another member.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth, loadSelf);

router.get('/', getDietOverview);
router.get('/plans', getDietAssignments);
router.get('/history', validate(historyQuery, 'query'), getNutritionHistory);
router.get('/days/:day', validate(dayParams, 'params'), getDietDay);
router.put('/days/:day/meals/:mealId', validate(mealParams, 'params'), validate(mealTickSchema), tickMeal);
router.post('/days/:day/items', validate(dayParams, 'params'), validate(extraItemSchema), idempotent(), addExtra);
router.delete('/days/:day/items/:itemId', validate(itemParams, 'params'), removeExtra);
router.put('/days/:day/water', validate(dayParams, 'params'), validate(waterSchema), setWaterGlasses);

export default router;
