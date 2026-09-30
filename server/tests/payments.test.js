import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedDeskModes,
  assertModeAccepted,
  buildPaymentFilter,
  buildUpiLink,
  normalizeUtr,
  planCollection,
  roundMoney,
} from '../services/paymentService.js';
import {
  gatewayConfig,
  hmacSha256Hex,
  planGatewayApplication,
  publicGatewayStatus,
  assertOnlineAvailable,
  safeEqualHex,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../services/onlinePaymentService.js';
import { amountInWords, renderReceiptHtml } from '../services/receiptService.js';
import { ageingBucket, comparisonPeriods, monthRange } from '../services/financeService.js';
import { csvCell, toCsv } from '../services/csvExport.js';
import { buildExpenseFilter, toClient } from '../services/expenseService.js';
import { memberStatus, toMemberPayment } from '../controllers/memberPaymentController.js';
import { upiReferenceSchema, verifyPaymentSchema, collectPaymentSchema } from '../validators/payment.schema.js';
import { createExpenseSchema } from '../validators/expense.schema.js';

// ── Partial payments

test('collecting without an amount settles the whole due', () => {
  assert.deepEqual(planCollection({ due: 5000, allowPartial: false }), { kind: 'full', amount: 5000, balance: 0 });
  assert.deepEqual(planCollection({ due: 5000, amount: 5000, allowPartial: false }), { kind: 'full', amount: 5000, balance: 0 });
});

test('a smaller amount is a part payment that leaves the rest due', () => {
  assert.deepEqual(planCollection({ due: 5000, amount: 2000, allowPartial: true }), { kind: 'partial', amount: 2000, balance: 3000 });
  // Paise are kept exact: 1499.99 - 0.33 is 1499.66, not 1499.6600000000001
  assert.deepEqual(planCollection({ due: 1499.99, amount: 0.33, allowPartial: true }), { kind: 'partial', amount: 0.33, balance: 1499.66 });
});

test('part payments are refused when turned off, and overpaying is refused always', () => {
  assert.throws(() => planCollection({ due: 5000, amount: 2000, allowPartial: false }), (e) => e.code === 'PARTIAL_NOT_ALLOWED' && e.statusCode === 422 && Boolean(e.details.fields.amount));
  assert.throws(() => planCollection({ due: 5000, amount: 5000.01, allowPartial: true }), (e) => e.code === 'AMOUNT_TOO_HIGH');
  assert.throws(() => planCollection({ due: 5000, amount: 0, allowPartial: true }), (e) => e.statusCode === 422);
});

test('roundMoney keeps two decimals', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney('1500.555'), 1500.56);
  assert.equal(roundMoney(undefined), 0);
});

// ── Accepted modes

test('desk modes follow the settings flags (missing flags count as on)', () => {
  assert.deepEqual(acceptedDeskModes({}), ['cash', 'upi', 'card']);
  assert.deepEqual(acceptedDeskModes({ acceptCash: false, acceptCard: false }), ['upi']);
  assert.throws(() => assertModeAccepted({ payments: { acceptCard: false } }, 'card'), (e) => e.code === "MODE_NOT_ACCEPTED" && Boolean(e.details.fields.mode));
  assert.doesNotThrow(() => assertModeAccepted({ payments: { acceptCard: false } }, 'cash'));
});

// ── List filters

test('payment filters: dues by raised date, paid by paid date, refunds by refund date', () => {
  const due = buildPaymentFilter({ status: 'pending', from: '2026-09-01', to: '2026-09-30' });
  assert.ok(due.filter.$and.some((c) => c.createdAt));
  assert.deepEqual(due.sort, { createdAt: 1 });

  const paid = buildPaymentFilter({ status: 'paid', mode: 'upi', type: 'renewal', from: '2026-09-01' });
  assert.ok(paid.filter.$and.some((c) => c.paidAt));
  assert.ok(paid.filter.$and.some((c) => c.mode === 'upi') && paid.filter.$and.some((c) => c.type === 'renewal'));
  // 1 Sep in Kota starts at 31 Aug 18:30 UTC.
  assert.equal(paid.filter.$and.find((c) => c.paidAt).paidAt.$gte.toISOString(), '2026-08-31T18:30:00.000Z');

  const refunded = buildPaymentFilter({ status: 'refunded', to: '2026-09-30' });
  assert.ok(refunded.filter.$and.some((c) => c['refund.at']));

  const awaiting = buildPaymentFilter({ status: 'awaiting' });
  assert.deepEqual(awaiting.filter.$and[0], { status: 'pending', 'verification.state': 'submitted' });

  assert.deepEqual(buildPaymentFilter({ status: 'all' }).filter, {});
});

// ── UPI

test('UPI link uses standard parameters, encodes names, and fixes the amount to paise', () => {
  const link = buildUpiLink({ upiId: 'kovij@okhdfc', payeeName: 'Kovij Fitness & Gym', amount: 1500, note: 'Kovij KFZ-2026-00042' });
  assert.equal(link, 'upi://pay?pa=kovij%40okhdfc&pn=Kovij%20Fitness%20%26%20Gym&am=1500.00&cu=INR&tn=Kovij%20KFZ-2026-00042');
  assert.ok(!link.includes('tr='), 'no merchant transaction ref (breaks personal UPI IDs in some apps)');
});

test('UTR input is normalised and validated', () => {
  assert.equal(normalizeUtr(' 4123 5678-9012 '), '412356789012');
  assert.equal(upiReferenceSchema.parse({ utr: 't2409 1234abcd' }).utr, 'T24091234ABCD');
  assert.equal(upiReferenceSchema.safeParse({ utr: '12345' }).success, false);
  assert.equal(upiReferenceSchema.safeParse({ utr: '<script>' }).success, false);
});

// ── Gateway signatures (known vectors, verified independently with openssl)

test('HMAC-SHA256 matches RFC 4231 test case 2', () => {
  assert.equal(hmacSha256Hex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});

test('checkout signature is HMAC of "order_id|payment_id" with the key secret', () => {
  const secret = 'EnLs21M47BllR3X8PSFtjtbd';
  const good = '46040aa0fb1adef188736117572c4bb2a1beb6d2818750add089e9eaf6f4596f';
  const input = { orderId: 'order_DBJOWzybf0sJbb', paymentId: 'pay_29QQoUBi66xm2f', signature: good };
  assert.equal(verifyCheckoutSignature(input, secret), true);
  assert.equal(verifyCheckoutSignature({ ...input, signature: good.toUpperCase() }, secret), true);
  assert.equal(verifyCheckoutSignature({ ...input, paymentId: 'pay_other' }, secret), false);
  assert.equal(verifyCheckoutSignature(input, 'wrong-secret'), false);
  assert.equal(verifyCheckoutSignature({ ...input, signature: good.slice(0, 63) }, secret), false);
  assert.equal(verifyCheckoutSignature(input, ''), false);
});

test('webhook signature is HMAC of the exact raw body with the webhook secret', () => {
  const body =
    '{"entity":"event","event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_29QQoUBi66xm2f","order_id":"order_DBJOWzybf0sJbb","amount":150000,"currency":"INR","status":"captured","method":"upi"}}}}';
  const sig = 'f3f9432a9a323c84bf2cd4cd87a91889f27c4d4928c5a74795367c4a9790bc17';
  assert.equal(verifyWebhookSignature(Buffer.from(body), sig, 'whsec_kovij_test'), true);
  assert.equal(verifyWebhookSignature(body, sig, 'whsec_kovij_test'), true);
  // Re-serialised JSON (different spacing) must fail: the signature covers the raw bytes.
  assert.equal(verifyWebhookSignature(JSON.stringify(JSON.parse(body), null, 1), sig, 'whsec_kovij_test'), false);
  assert.equal(verifyWebhookSignature(Buffer.from(body), sig, 'other'), false);
  assert.equal(verifyWebhookSignature(Buffer.from(body), undefined, 'whsec_kovij_test'), false);
  assert.equal(safeEqualHex('abc', undefined), false);
});

test('gateway status never exposes secrets and needs both keys plus the setting', () => {
  const env = { RAZORPAY_KEY_ID: 'rzp_live_abc', RAZORPAY_KEY_SECRET: 'secret-value', RAZORPAY_WEBHOOK_SECRET: 'wh' };
  const status = publicGatewayStatus({ payments: { onlineEnabled: true } }, env);
  assert.deepEqual(status, { provider: 'razorpay', configured: true, webhookConfigured: true, mode: 'live', onlineEnabled: true, available: true });
  assert.ok(!JSON.stringify(status).includes('secret-value'));
  assert.equal(publicGatewayStatus({ payments: { onlineEnabled: true } }, { RAZORPAY_KEY_ID: 'rzp_test_x' }).available, false);
  assert.equal(gatewayConfig({ RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 's' }).mode, 'test');
  assert.throws(() => assertOnlineAvailable({ payments: { onlineEnabled: true } }, {}), (e) => e.code === 'ONLINE_PAYMENTS_OFF' && e.statusCode === 409);
  assert.throws(() => assertOnlineAvailable({ payments: { onlineEnabled: false } }, env), (e) => e.code === 'ONLINE_PAYMENTS_OFF');
});

test('gateway money is applied once: settle the due, flag anything extra for review', () => {
  const base = { orderStatus: 'created', dueStatus: 'pending', dueAmount: 1500, paidAmount: 1500, gatewayPaymentId: 'pay_1' };
  assert.deepEqual(planGatewayApplication(base), { replay: false, apply: 1500, extra: 0, reason: null });
  // Same gateway payment confirmed again (webhook after checkout): nothing new.
  assert.equal(planGatewayApplication({ ...base, orderStatus: 'paid', orderGatewayPaymentId: 'pay_1' }).replay, true);
  // A second, different payment on an already-paid order: all of it for review.
  assert.deepEqual(planGatewayApplication({ ...base, orderStatus: 'paid', orderGatewayPaymentId: 'pay_1', gatewayPaymentId: 'pay_2' }), {
    replay: false, apply: 0, extra: 1500, reason: 'second_payment_on_order',
  });
  // Desk collected cash while the member was paying online.
  assert.deepEqual(planGatewayApplication({ ...base, dueStatus: 'paid' }), { replay: false, apply: 0, extra: 1500, reason: 'due_already_settled' });
  // Desk took part in the meantime: settle the rest, flag the extra.
  assert.deepEqual(planGatewayApplication({ ...base, dueAmount: 1000 }), { replay: false, apply: 1000, extra: 500, reason: 'overpaid' });
});

// ── Receipts

test('amount in words uses the Indian system', () => {
  assert.equal(amountInWords(1500), 'Rupees One Thousand Five Hundred Only');
  assert.equal(amountInWords(12_34_567), 'Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only');
  assert.equal(amountInWords(2_05_00_000), 'Rupees Two Crore Five Lakh Only');
  assert.equal(amountInWords(999.5), 'Rupees Nine Hundred Ninety Nine and Fifty Paise Only');
  assert.equal(amountInWords(0), 'Rupees Zero Only');
  assert.equal(amountInWords(0.75), 'Seventy Five Paise Only');
});

test('receipt escapes member data and shows part payment and refund details', () => {
  const member = { name: '<img src=x onerror=alert(1)>', memberCode: 'KFZ-0001', phone: '9876543210' };
  const settings = { gymName: 'Kovij & Co', address: 'Kota', logoUrl: 'javascript:alert(1)' };
  const part = { invoiceNo: 'KFZ-2026-00010', type: 'membership', amount: 2000, status: 'paid', mode: 'upi', txnRef: '412345678901', paidAt: new Date(), dueId: 'x', balanceAfter: 3000 };
  const html = renderReceiptHtml({ member, payment: part, settings, planName: 'Quarterly', due: { invoiceNo: 'KFZ-2026-00007', originalAmount: 5000 } });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;') && !html.includes('<img src=x'));
  assert.ok(html.includes('Kovij &amp; Co'));
  assert.ok(!html.includes('javascript:'), 'only http(s) logos are used');
  assert.ok(html.includes('KFZ-2026-00007') && html.includes('Balance due after this payment') && html.includes('₹3,000'));
  assert.ok(html.includes('Rupees Two Thousand Only'));

  const refunded = renderReceiptHtml({ member: { name: 'Asha' }, payment: { ...part, dueId: undefined, status: 'refunded', refund: { amount: 2000, reason: 'Moved city', at: new Date() } }, settings });
  assert.ok(refunded.includes('Refunded') && refunded.includes('Moved city'));
});

// ── Revenue

test('dues age in whole gym days', () => {
  const now = new Date('2026-09-30T06:00:00Z'); // 11:30 in Kota
  assert.equal(ageingBucket(new Date('2026-09-30T00:00:00Z'), now), '0_7');
  assert.equal(ageingBucket(new Date('2026-09-23T05:00:00Z'), now), '0_7'); // 7 days
  assert.equal(ageingBucket(new Date('2026-09-22T05:00:00Z'), now), '8_30'); // 8 days
  assert.equal(ageingBucket(new Date('2026-08-31T05:00:00Z'), now), '8_30'); // 30 days
  assert.equal(ageingBucket(new Date('2026-08-30T05:00:00Z'), now), '31_plus');
});

test('comparisons stop at the same point in the previous period', () => {
  const now = new Date('2026-03-31T06:30:00Z'); // 31 Mar 12:00 IST
  const p = comparisonPeriods(now);
  assert.equal(p.month.from.toISOString(), '2026-02-28T18:30:00.000Z'); // 1 Mar 00:00 IST
  assert.equal(p.month.prevFrom.toISOString(), '2026-01-31T18:30:00.000Z'); // 1 Feb 00:00 IST
  assert.equal(p.month.prevTo.toISOString(), '2026-02-28T06:30:00.000Z'); // clamped to 28 Feb, same time
  assert.equal(p.today.prevTo.toISOString(), '2026-03-30T06:30:00.000Z');
  assert.equal(p.year.prevFrom.toISOString(), '2024-12-31T18:30:00.000Z');
});

test('month range is the gym-local calendar month', () => {
  const r = monthRange('2026-02');
  assert.equal(r.key, '2026-02');
  assert.equal(r.from.toISOString(), '2026-01-31T18:30:00.000Z');
  assert.equal(r.to.toISOString(), '2026-02-28T18:30:00.000Z');
});

// ── CSV

test('CSV quotes, keeps UTF-8 for Excel, and neutralises formulas', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+91 98765'), "'+91 98765");
  assert.equal(csvCell('Sharma, Priya'), '"Sharma, Priya"');
  assert.equal(csvCell(-500), '-500');
  assert.equal(csvCell(null), '');
  const csv = toCsv([{ header: 'Name', value: (r) => r.n }, { header: 'Amount', value: (r) => r.a }], [{ n: 'रवि', a: 1500 }]);
  assert.ok(csv.startsWith('﻿Name,Amount\r\n'));
  assert.ok(csv.includes('रवि,1500'));
});

// ── Expenses

test('expense filters and API shape keep deleted rows and file paths out', () => {
  const f = buildExpenseFilter({ month: '2026-09', category: 'rent', q: 'sharma' });
  assert.equal(f.deletedAt, null);
  assert.equal(f.category, 'rent');
  assert.equal(f.spentOn.$gte.toISOString(), '2026-08-31T18:30:00.000Z');
  const shaped = toClient({ _id: '1', dayKey: '2026-09-02', amount: 10, bill: { ref: 'private:expense-bills/a.pdf', name: 'a.pdf', mime: 'application/pdf', size: 3 }, idempotencyKey: 'k' });
  assert.equal(shaped.date, '2026-09-02');
  assert.deepEqual(Object.keys(shaped.bill).sort(), ['mime', 'name', 'size', 'uploadedAt']);
  assert.ok(!JSON.stringify(shaped).includes('private:'));
  assert.equal(shaped.idempotencyKey, undefined);
});

test('expense validation: category, positive amount, no future dates', () => {
  assert.equal(createExpenseSchema.safeParse({ category: 'rent', amount: 25000, date: '2026-09-01' }).success, true);
  assert.equal(createExpenseSchema.safeParse({ category: 'party', amount: 1, date: '2026-09-01' }).success, false);
  assert.equal(createExpenseSchema.safeParse({ category: 'rent', amount: 0, date: '2026-09-01' }).success, false);
  assert.equal(createExpenseSchema.safeParse({ category: 'rent', amount: 1, date: '2999-01-01' }).success, false);
});

// ── Staff and member request shapes

test('rejecting a UPI reference needs a reason; collecting may name an amount', () => {
  assert.equal(verifyPaymentSchema.safeParse({ decision: 'reject' }).success, false);
  assert.equal(verifyPaymentSchema.safeParse({ decision: 'reject', reason: 'Not in bank app' }).success, true);
  assert.equal(verifyPaymentSchema.safeParse({ decision: 'confirm' }).success, true);
  assert.equal(collectPaymentSchema.safeParse({ mode: 'cash', amount: 500 }).success, true);
  assert.equal(collectPaymentSchema.safeParse({ mode: 'online' }).success, false, 'online is only recorded by the gateway');
});

test('member payment shape: status words, part-payment progress, no staff-only fields', () => {
  assert.equal(memberStatus({ status: 'pending', verification: { state: 'submitted' } }), 'awaiting_verification');
  assert.equal(memberStatus({ status: 'pending', verification: { state: 'rejected' } }), 'due');
  assert.equal(memberStatus({ status: 'failed' }), 'cancelled');
  const due = toMemberPayment({ _id: 'd1', invoiceNo: 'KFZ-1', type: 'renewal', amount: 3000, originalAmount: 5000, status: 'pending', membershipId: { planName: 'Quarterly' }, recordedBy: 'staff1', idempotencyKey: 'k' });
  assert.equal(due.status, 'due');
  assert.equal(due.paidSoFar, 2000);
  assert.equal(due.forLabel, 'Membership renewal: Quarterly');
  assert.equal(due.receiptAvailable, false);
  assert.equal(due.recordedBy, undefined);
  assert.equal(due.idempotencyKey, undefined);
});
