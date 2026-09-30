import express from 'express';
import { listMine, getBill } from '../controllers/paymentController.js';
import { memberAuth } from '../middleware/memberAuth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';

/**
 * Member-facing payment reads. Members can no longer record payments themselves;
 * money is recorded by staff at /api/admin/payments.
 */
const router = express.Router();

router.get('/me', memberAuth, listMine);
router.get('/:id/bill', memberAuth, validate(idParam, 'params'), getBill);

export default router;
