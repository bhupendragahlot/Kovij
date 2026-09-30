import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import {
  endingQuery,
  extendSchema,
  freezeSchema,
  lapsedQuery,
  renewalHistoryQuery,
  settleTestSchema,
  unfreezeSchema,
} from '../../validators/membership.schema.js';
import { ending, extend, freeze, lapsed, renewalHistory, settleForTest, unfreeze } from '../../controllers/membershipOpsController.js';

/**
 * OWNER: members & membership lifecycle module. Mounted at /api/admin/memberships.
 * Freeze / unfreeze / extend a plan (managers), and the renewals desk lists.
 */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
router.use(adminAuth);

router.get('/ending', requirePermission('renewals.view'), validate(endingQuery, 'query'), ending);
router.get('/lapsed', requirePermission('renewals.view'), validate(lapsedQuery, 'query'), lapsed);
router.get('/renewal-history', requirePermission('renewals.view'), validate(renewalHistoryQuery, 'query'), renewalHistory);

router.post('/:id/freeze', byId, requirePermission('memberships.freeze'), validate(freezeSchema), idempotent(), freeze);
router.post('/:id/unfreeze', byId, requirePermission('memberships.freeze'), validate(unfreezeSchema), idempotent({ required: false }), unfreeze);
router.post('/:id/extend', byId, requirePermission('memberships.extend'), validate(extendSchema), idempotent(), extend);

// Lets the e2e suite run the daily freeze roll-over at a chosen time. Never mounted outside tests.
if (process.env.NODE_ENV === 'test') {
  router.post('/_test/settle', requirePermission('memberships.freeze'), validate(settleTestSchema), settleForTest);
}

export default router;
