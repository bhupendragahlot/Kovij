import express from 'express';
import { sendBillEmail } from '../controllers/adminPaymentController.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();
router.use(adminAuth);
router.post('/:paymentId/send-bill', sendBillEmail);

export default router;
