import express from 'express';
import { recordPayment, listMine, getBill } from '../controllers/paymentController.js';
import { memberAuth } from '../middleware/memberAuth.js';
import { validate } from '../middleware/validate.js';
import { recordPaymentSchema } from '../validators/payment.schema.js';

const router = express.Router();

router.post('/record', memberAuth, validate(recordPaymentSchema), recordPayment);
router.get('/me', memberAuth, listMine);
router.get('/:id/bill', memberAuth, getBill);

export default router;
