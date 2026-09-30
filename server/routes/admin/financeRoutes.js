import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { financeQuery } from '../../validators/payment.schema.js';
import { overview } from '../../controllers/financeController.js';

/**
 * OWNER: payments, finance & expenses module. Mounted at /api/admin/finance.
 * Revenue figures are for the owner and managers (`revenue.view`).
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('revenue.view'));

router.get('/overview', validate(financeQuery, 'query'), overview);

export default router;
