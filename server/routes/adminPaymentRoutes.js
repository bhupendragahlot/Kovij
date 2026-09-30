import express from 'express';
import {
  listPayments,
  exportPayments,
  getPayment,
  recordPayment,
  collectPayment,
  refundPaymentHandler,
  verifyPayment,
  getReceipt,
  sendReceiptEmail,
  onlineStatus,
} from '../controllers/adminPaymentController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate } from '../middleware/validate.js';
import { idempotent } from '../middleware/idempotency.js';
import { idParam } from '../validators/common.js';
import {
  listPaymentsQuery,
  exportPaymentsQuery,
  recordPaymentSchema,
  collectPaymentSchema,
  refundPaymentSchema,
  verifyPaymentSchema,
} from '../validators/payment.schema.js';

/**
 * OWNER: payments module. Mounted at /api/admin/payments.
 * Trainers have none of these permissions, so they never reach money.
 */
const router = express.Router();
const byId = validate(idParam, 'params');

router.use(adminAuth);

router.get('/', requirePermission('payments.view'), validate(listPaymentsQuery, 'query'), listPayments);
// Bulk export is the whole money history, so it is for managers.
router.get('/export.csv', requirePermission('revenue.view'), validate(exportPaymentsQuery, 'query'), exportPayments);
router.get('/online-status', requirePermission('payments.view'), onlineStatus);

// Money-moving endpoints require an Idempotency-Key so network retries never double-charge.
router.post('/', requirePermission('payments.collect'), validate(recordPaymentSchema), idempotent(), recordPayment);
router.post('/:id/collect', requirePermission('payments.collect'), byId, validate(collectPaymentSchema), idempotent(), collectPayment);
router.post('/:id/verify', requirePermission('payments.collect'), byId, validate(verifyPaymentSchema), idempotent(), verifyPayment);
router.post('/:id/refund', requirePermission('payments.refund'), byId, validate(refundPaymentSchema), idempotent(), refundPaymentHandler);

router.get('/:id', requirePermission('payments.view'), byId, getPayment);
router.get('/:id/receipt', requirePermission('payments.view'), byId, getReceipt);
router.post('/:id/send-receipt', requirePermission('payments.view'), byId, sendReceiptEmail);

export default router;
