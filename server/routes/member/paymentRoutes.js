import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import { memberPaymentsQuery, onlineVerifySchema, upiReferenceSchema } from '../../validators/payment.schema.js';
import {
  createOnlineOrder,
  emailMyReceipt,
  getMyPayment,
  getMyReceipt,
  getUpiIntent,
  listMyDues,
  listMyPayments,
  submitUpiRef,
  verifyOnlinePayment,
} from '../../controllers/memberPaymentController.js';

/**
 * OWNER: payments, finance & expenses module. Mounted at /api/member/payments.
 * Member app: history, dues, receipts, and paying a due by UPI or online checkout.
 */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
router.use(memberAuth);

router.get('/', validate(memberPaymentsQuery, 'query'), listMyPayments);
router.get('/dues', listMyDues);
router.get('/dues/:id/upi', byId, getUpiIntent);
router.post('/dues/:id/upi-reference', byId, validate(upiReferenceSchema), idempotent(), submitUpiRef);
router.post('/dues/:id/online-order', byId, idempotent(), createOnlineOrder);
// Idempotent by the gateway payment id itself, so the key is optional here.
router.post('/online/verify', validate(onlineVerifySchema), idempotent({ required: false }), verifyOnlinePayment);
router.get('/:id', byId, getMyPayment);
router.get('/:id/receipt', byId, getMyReceipt);
router.post('/:id/email-receipt', byId, emailMyReceipt);

export default router;
