/**
 * Card/UPI checkout through Razorpay, without an SDK: orders over `fetch`, signatures with HMAC.
 *
 * Flow: the member app asks for an order for one due → opens Razorpay Checkout → sends back
 * { order_id, payment_id, signature } → we verify the signature and record the payment. Razorpay
 * also calls our webhook (payment.captured / order.paid). Both paths go through
 * recordGatewayPayment(), which records each gateway payment id exactly once.
 *
 * Keys come only from the environment (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
 * RAZORPAY_WEBHOOK_SECRET) and never leave the server except the public key id checkout needs.
 */
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import PaymentOrder from '../models/PaymentOrder.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { withTransaction } from '../utils/db.js';
import { logger } from '../utils/logger.js';
import { collectDue, createPayment, roundMoney } from './paymentService.js';

const API_BASE = () => (process.env.RAZORPAY_API_URL || 'https://api.razorpay.com/v1').replace(/\/$/, '');
/** Reuse a member's unpaid checkout for the same bill and amount instead of opening a new order each tap. */
const ORDER_REUSE_MS = 30 * 60 * 1000;

export function gatewayConfig(env = process.env) {
  const keyId = (env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = (env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = (env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  return {
    provider: 'razorpay',
    configured: Boolean(keyId && keySecret),
    webhookConfigured: Boolean(webhookSecret),
    mode: keyId ? (keyId.startsWith('rzp_live_') ? 'live' : 'test') : null,
    keyId,
    keySecret,
    webhookSecret,
  };
}

/** What staff and members may know about online payments. Never includes secrets. */
export function publicGatewayStatus(settings, env = process.env) {
  const cfg = gatewayConfig(env);
  const onlineEnabled = Boolean(settings?.payments?.onlineEnabled);
  return {
    provider: cfg.provider,
    configured: cfg.configured,
    webhookConfigured: cfg.webhookConfigured,
    mode: cfg.mode,
    onlineEnabled,
    available: cfg.configured && onlineEnabled,
  };
}

export function assertOnlineAvailable(settings, env = process.env) {
  const status = publicGatewayStatus(settings, env);
  if (!status.configured) {
    throw new AppError('Online payments are not set up at this gym yet. Pay by UPI or at the front desk.', 409, 'ONLINE_PAYMENTS_OFF');
  }
  if (!status.onlineEnabled) {
    throw new AppError('Online payments are turned off at this gym. Pay by UPI or at the front desk.', 409, 'ONLINE_PAYMENTS_OFF');
  }
  return gatewayConfig(env);
}

export const hmacSha256Hex = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

/** Constant-time comparison of two hex strings. */
export function safeEqualHex(expected, given) {
  if (typeof expected !== 'string' || typeof given !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given.trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Checkout callback: signature = HMAC-SHA256(order_id + "|" + payment_id, key secret). */
export function verifyCheckoutSignature({ orderId, paymentId, signature }, keySecret) {
  if (!orderId || !paymentId || !signature || !keySecret) return false;
  return safeEqualHex(hmacSha256Hex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook: X-Razorpay-Signature = HMAC-SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  if (!rawBody || !signature || !webhookSecret) return false;
  return safeEqualHex(hmacSha256Hex(webhookSecret, rawBody), signature);
}

/**
 * Where money from one gateway payment goes. Pure.
 *   replay  this gateway payment was already recorded on this order
 *   apply   rupees settled against the due (full or part)
 *   extra   rupees recorded as a separate payment flagged for review (paid twice, or overpaid)
 */
export function planGatewayApplication({ orderStatus, orderGatewayPaymentId, dueStatus, dueAmount, paidAmount, gatewayPaymentId }) {
  if (orderStatus === 'paid' && orderGatewayPaymentId === gatewayPaymentId) return { replay: true, apply: 0, extra: 0, reason: null };
  const paid = roundMoney(paidAmount);
  if (orderStatus === 'paid') return { replay: false, apply: 0, extra: paid, reason: 'second_payment_on_order' };
  if (dueStatus !== 'pending') return { replay: false, apply: 0, extra: paid, reason: 'due_already_settled' };
  const apply = roundMoney(Math.min(paid, roundMoney(dueAmount)));
  const extra = roundMoney(paid - apply);
  return { replay: false, apply, extra, reason: extra > 0 ? 'overpaid' : null };
}

const REVIEW_NOTES = {
  second_payment_on_order: 'Paid online a second time for the same bill. Refund or adjust it.',
  due_already_settled: 'Paid online after this bill was already settled. Refund or adjust it.',
  overpaid: 'Paid online more than was due. Refund or adjust the extra.',
};

async function razorpayRequest(cfg, method, path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE()}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    logger.warn(`Razorpay ${method} ${path} failed: ${e.message}`);
    throw new AppError("Couldn't reach the payment service. Try again in a minute, or pay at the desk.", 502, 'GATEWAY_UNREACHABLE');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.warn(`Razorpay ${method} ${path} → ${res.status}: ${data?.error?.description || ''}`);
    throw new AppError('The payment service refused this request. Try again, or pay at the desk.', 502, 'GATEWAY_ERROR');
  }
  return data;
}

/**
 * Start (or reuse) a checkout for one of the member's dues.
 * @returns {{ order, checkout }} what the member app passes to Razorpay Checkout
 */
export async function startOnlineOrder({ memberId, dueId, member }) {
  const settings = await getSettingsDoc();
  const cfg = assertOnlineAvailable(settings);

  const due = await Payment.findOne({ _id: dueId, memberId }).lean();
  if (!due) throw new AppError('Bill not found', 404, 'NOT_FOUND');
  if (due.status === 'paid') throw new AppError('This bill is already paid', 409, 'ALREADY_PAID');
  if (due.status !== 'pending') throw new AppError('This bill was cancelled, so there is nothing to pay', 409, 'NOT_DUE');
  if (due.verification?.state === 'submitted') {
    throw new AppError('You already sent a UPI reference for this bill. The gym will check it soon.', 409, 'ALREADY_SUBMITTED');
  }
  const amount = roundMoney(due.amount);
  if (amount < 1) throw new AppError('Online payments must be at least ₹1. Pay the rest at the desk.', 422, 'AMOUNT_TOO_LOW');

  let order = await PaymentOrder.findOne({
    paymentId: due._id,
    status: 'created',
    amount,
    createdAt: { $gte: new Date(Date.now() - ORDER_REUSE_MS) },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!order) {
    const created = await razorpayRequest(cfg, 'POST', '/orders', {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: due.invoiceNo || String(due._id),
      notes: { paymentId: String(due._id), memberId: String(memberId) },
    });
    order = (
      await PaymentOrder.create({ orderId: created.id, paymentId: due._id, memberId, amount, currency: 'INR' })
    ).toObject();
  }

  return {
    order: { id: order.orderId, amount: order.amount, amountPaise: Math.round(order.amount * 100), currency: order.currency, status: order.status },
    checkout: {
      provider: 'razorpay',
      key: cfg.keyId,
      orderId: order.orderId,
      amount: Math.round(order.amount * 100),
      currency: order.currency,
      name: settings.gymName || 'Kovij Fitness Zone',
      description: `Bill ${due.invoiceNo || ''}`.trim(),
      prefill: { name: member?.name || '', email: member?.email || '', contact: member?.phone || '' },
      notes: { paymentId: String(due._id) },
    },
  };
}

/** Details of one gateway payment (status, amount, method). Used after a checkout callback. */
export async function fetchGatewayPayment(gatewayPaymentId, cfg = gatewayConfig()) {
  return razorpayRequest(cfg, 'GET', `/payments/${encodeURIComponent(gatewayPaymentId)}`);
}

/** Already recorded? (the gateway id sits on the row that took the money, or on its review row) */
async function findRecorded(gatewayPaymentId, session) {
  return Payment.findOne({
    $or: [{ 'gateway.paymentId': gatewayPaymentId }, { idempotencyKey: `razorpay:${gatewayPaymentId}:extra` }],
  }).session(session ?? null);
}

/**
 * Record money from one captured gateway payment, exactly once, whichever path gets here first.
 * @param {{ orderId: string, gatewayPaymentId: string, amountPaise?: number, method?: string, source: 'checkout'|'webhook' }} input
 * @returns {{ payment, replayed: boolean, activatedMembership, reviewNeeded: boolean }}
 */
export async function recordGatewayPayment({ orderId, gatewayPaymentId, amountPaise, method, source }) {
  const already = await findRecorded(gatewayPaymentId);
  if (already) return { payment: already, replayed: true, activatedMembership: null, reviewNeeded: Boolean(already.meta?.needsReview) };

  const settings = await getSettingsDoc();
  let outcome;
  try {
    outcome = await withTransaction(async (session) => {
      const recorded = await findRecorded(gatewayPaymentId, session);
      if (recorded) return { payment: recorded, replayed: true, activatedMembership: null, reviewNeeded: Boolean(recorded.meta?.needsReview) };

      const order = await PaymentOrder.findOne({ provider: 'razorpay', orderId }).session(session);
      if (!order) throw new AppError('Unknown payment order', 404, 'ORDER_NOT_FOUND');
      const due = await Payment.findById(order.paymentId).session(session);
      const paidAmount = amountPaise != null ? roundMoney(amountPaise / 100) : order.amount;
      const plan = planGatewayApplication({
        orderStatus: order.status,
        orderGatewayPaymentId: order.gatewayPaymentId,
        dueStatus: due?.status,
        dueAmount: due?.amount,
        paidAmount,
        gatewayPaymentId,
      });
      const gateway = { provider: 'razorpay', orderId, paymentId: gatewayPaymentId, method: method || '' };

      let main = null;
      let activatedMembership = null;
      if (plan.apply > 0) {
        const result = await collectDue(
          due._id,
          {
            amount: plan.apply,
            mode: 'online',
            txnRef: gatewayPaymentId,
            gateway,
            // Money already arrived, so a short payment is still recorded as a part payment.
            allowPartial: true,
            invoicePrefix: settings.invoicePrefix,
          },
          session
        );
        main = result.payment;
        activatedMembership = result.activatedMembership;
      }

      let review = null;
      if (plan.extra > 0) {
        review = await createPayment(
          {
            memberId: order.memberId,
            membershipId: due?.membershipId,
            type: main ? 'other' : due?.type || 'other',
            amount: plan.extra,
            status: 'paid',
            mode: 'online',
            txnRef: gatewayPaymentId,
            note: REVIEW_NOTES[plan.reason] || 'Paid online. Check this payment.',
            idempotencyKey: `razorpay:${gatewayPaymentId}:extra`,
            // The gateway id is unique per row: it goes on the extra row only when nothing else took it.
            gateway: main ? { provider: 'razorpay', orderId, method: method || '' } : gateway,
            meta: { needsReview: true, reason: plan.reason, gatewayPaymentId, dueId: due ? String(due._id) : null },
          },
          { session, invoicePrefix: settings.invoicePrefix }
        );
      }

      if (order.status !== 'paid') {
        order.status = 'paid';
        order.gatewayPaymentId = gatewayPaymentId;
        order.paidAt = new Date();
        order.confirmedBy = source;
        await order.save({ session });
      }
      return { payment: main || review, replayed: false, activatedMembership, reviewNeeded: Boolean(review) };
    });
  } catch (e) {
    // Two confirmations raced past the first check: the loser sees the winner's row.
    if (e?.code === 11000) {
      const recorded = await findRecorded(gatewayPaymentId);
      if (recorded) return { payment: recorded, replayed: true, activatedMembership: null, reviewNeeded: Boolean(recorded.meta?.needsReview) };
    }
    throw e;
  }
  if (outcome.reviewNeeded) logger.warn(`Online payment ${gatewayPaymentId} on order ${orderId} needs review`);
  return outcome;
}
