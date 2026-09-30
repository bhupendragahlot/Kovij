import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import { gatewayConfig, recordGatewayPayment, verifyWebhookSignature } from '../services/onlinePaymentService.js';
import { notifyMembershipActivated, sendReceipt } from '../services/receiptService.js';

const RECORD_EVENTS = new Set(['payment.captured', 'order.paid']);

/**
 * POST /api/webhooks/razorpay
 * Razorpay signs the exact request bytes with the webhook secret. Anything unsigned is refused;
 * events we don't act on are acknowledged so Razorpay stops retrying them.
 */
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const { webhookSecret } = gatewayConfig();
  if (!webhookSecret) throw new AppError('Payment webhooks are not set up on this server', 503, 'WEBHOOK_NOT_CONFIGURED');
  if (!verifyWebhookSignature(req.rawBody, req.get('X-Razorpay-Signature'), webhookSecret)) {
    throw new AppError('Invalid signature', 400, 'BAD_SIGNATURE');
  }

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity;
  if (!RECORD_EVENTS.has(event) || !entity?.id || !entity?.order_id) {
    return res.json({ success: true, ignored: true });
  }
  if (entity.status && entity.status !== 'captured') return res.json({ success: true, ignored: true, reason: 'not_captured' });
  if (entity.currency && entity.currency !== 'INR') {
    logger.warn(`Razorpay webhook: ${entity.id} is in ${entity.currency}, not recorded`);
    return res.json({ success: true, ignored: true, reason: 'currency' });
  }

  try {
    const result = await recordGatewayPayment({
      orderId: entity.order_id,
      gatewayPaymentId: entity.id,
      amountPaise: entity.amount,
      method: entity.method,
      source: 'webhook',
    });
    if (!result.replayed) {
      sendReceipt(result.payment._id, { auto: true }).catch((e) => logger.warn(`Online receipt failed for ${result.payment._id}: ${e.message}`));
      notifyMembershipActivated(result.activatedMembership).catch((e) => logger.warn(`Activation notice failed: ${e.message}`));
    }
    res.json({ success: true, recorded: !result.replayed, replayed: result.replayed });
  } catch (e) {
    // Orders we never created (another app on the same Razorpay account): acknowledge and move on.
    if (e?.code === 'ORDER_NOT_FOUND') return res.json({ success: true, ignored: true, reason: 'unknown_order' });
    throw e;
  }
});
