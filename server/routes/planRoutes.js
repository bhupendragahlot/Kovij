import express from 'express';
import { plans } from '../controllers/planController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { planSchema, planPatchSchema } from '../validators/catalog.schema.js';

/** OWNER: members & membership lifecycle module. Public reads (website pricing); writes need plans.manage. */
const router = express.Router();
const byId = validate(idParam, 'params');
const canManage = requirePermission('plans.manage');

router.get('/', plans.listPublic);
router.get('/:id', byId, plans.getPublic);
router.post('/', adminAuth, canManage, validate(planSchema), plans.create);
router.put('/:id', byId, adminAuth, canManage, validate(planPatchSchema), plans.update);
router.patch('/:id', byId, adminAuth, canManage, validate(planPatchSchema), plans.update);
router.delete('/:id', byId, adminAuth, canManage, plans.remove);

export default router;
