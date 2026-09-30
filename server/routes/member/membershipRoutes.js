import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { memberHistoryQuery, memberPlanRequestSchema, memberRequestParams } from '../../validators/membership.schema.js';
import { cancelRequest, getCard, getMyHistory, getMyMembership, getPlans, requestPlan } from '../../controllers/memberMembershipController.js';

/**
 * OWNER: members & membership lifecycle module. Mounted at /api/member/membership.
 * The signed-in member's plan, history, plans to buy, renewal requests, and membership card.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/', getMyMembership);
router.get('/history', validate(memberHistoryQuery, 'query'), getMyHistory);
router.get('/plans', getPlans);
router.get('/card', getCard);
router.post('/requests', validate(memberPlanRequestSchema), idempotent(), requestPlan);
router.post('/requests/:id/cancel', validate(memberRequestParams, 'params'), cancelRequest);

export default router;
