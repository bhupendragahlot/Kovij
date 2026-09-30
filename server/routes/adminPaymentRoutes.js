import express from 'express';
import {
  listPayments,
  recordPayment,
  collectPayment,
  getReceipt,
  sendReceiptEmail,
} from '../controllers/adminPaymentController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { validate } from '../middleware/validate.js';
import { idempotent } from '../middleware/idempotency.js';
import { idParam } from '../validators/common.js';
import { listPaymentsQuery, recordPaymentSchema, collectPaymentSchema } from '../validators/payment.schema.js';

const router = express.Router();
const byId = validate(idParam, 'params');

router.use(adminAuth);

router.get('/', validate(listPaymentsQuery, 'query'), listPayments);
// Money-moving endpoints require an Idempotency-Key so network retries never double-charge.
router.post('/', validate(recordPaymentSchema), idempotent(), recordPayment);
router.post('/:id/collect', byId, validate(collectPaymentSchema), idempotent(), collectPayment);
router.get('/:id/receipt', byId, getReceipt);
router.post('/:id/send-receipt', byId, sendReceiptEmail);

export default router;
