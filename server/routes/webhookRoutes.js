import express from 'express';
import { razorpayWebhook } from '../controllers/webhookController.js';

/**
 * OWNER: payments, finance & expenses module. Mounted at /api/webhooks.
 * Public (no auth): every handler must verify the provider's signature against req.rawBody.
 */
const router = express.Router();

router.post('/razorpay', razorpayWebhook);

export default router;
