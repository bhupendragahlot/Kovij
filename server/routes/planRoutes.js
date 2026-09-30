import express from 'express';
import { plans } from '../controllers/planController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requireManager } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { planSchema, planPatchSchema } from '../validators/catalog.schema.js';

const router = express.Router();
const byId = validate(idParam, 'params');

router.get('/', plans.listPublic);
router.get('/:id', byId, plans.getPublic);
router.post('/', adminAuth, requireManager, validate(planSchema), plans.create);
router.put('/:id', byId, adminAuth, requireManager, validate(planPatchSchema), plans.update);
router.patch('/:id', byId, adminAuth, requireManager, validate(planPatchSchema), plans.update);
router.delete('/:id', byId, adminAuth, requireManager, plans.remove);

export default router;
