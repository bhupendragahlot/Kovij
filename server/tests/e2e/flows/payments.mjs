// Payments, online payments, revenue and expenses: money paths, permissions, validation, idempotency.
import { createRequire } from 'node:module';
import { adminToken, call, check, createMember, createPlan, finish, key, memberToken, staffToken, uniq, uniqPhone } from '../lib.mjs';

const require = createRequire(import.meta.url);
const T = await adminToken();
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);
const manager = await staffToken('manager', T);
const D = desk.token;
const TR = trainer.token;
const M = manager.token;

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const thisMonth = today.slice(0, 7);

// Settings this flow relies on (restored at the end so later flows see what they expect).
const initial = (await call('GET', '/admin/settings', { token: T })).body.settings;
const setPayments = (payments) => call('PATCH', '/admin/settings', { token: T, body: { payments } });
await call('PATCH', '/admin/settings', { token: T, body: { registrationFee: 0 } });
await setPayments({ upiId: 'kovij@okicici', payeeName: 'Kovij Fitness', allowPartial: true, acceptCash: true, acceptUpi: true, acceptCard: true, onlineEnabled: false });

const plan = await createPlan(T, { price: 1500 });
const dueFor = async (memberId) =>
  (await call('GET', `/admin/payments?status=pending&memberId=${memberId}`, { token: T })).body.payments;
const inboxKinds = async (token) => {
  const r = await call('GET', '/member/notifications', { token });
  const list = r.body?.notifications || r.body?.items || [];
  return r.status === 200 ? list.map((n) => n.kind) : null;
};
const finance = async () => (await call('GET', `/admin/finance/overview?month=${thisMonth}`, { token: T })).body;

// ── Permissions: trainers never reach money; the front desk can collect but not refund or see revenue
{
  const { member } = await createMember(T, { planId: plan._id, collect: 'later' });
  const [due] = await dueFor(member._id);
  const trainerCalls = [
    ['GET', '/admin/payments'],
    ['GET', '/admin/payments/export.csv'],
    ['GET', '/admin/payments/online-status'],
    ['GET', `/admin/payments/${due._id}`],
    ['GET', `/admin/payments/${due._id}/receipt`],
    ['POST', '/admin/payments', { memberId: member._id, type: 'other', amount: 10, mode: 'cash' }],
    ['POST', `/admin/payments/${due._id}/collect`, { mode: 'cash' }],
    ['POST', `/admin/payments/${due._id}/verify`, { decision: 'confirm' }],
    ['POST', `/admin/payments/${due._id}/refund`, { reason: 'Test refund' }],
    ['POST', `/admin/payments/${due._id}/send-receipt`],
    ['GET', '/admin/finance/overview'],
    ['GET', '/admin/expenses'],
    ['POST', '/admin/expenses', { category: 'rent', amount: 100, date: today }],
    ['GET', '/admin/expenses/export.csv'],
  ];
  const trainerStatuses = [];
  for (const [method, path, body] of trainerCalls) trainerStatuses.push((await call(method, path, { token: TR, body, idem: method === 'POST' ? key() : undefined })).status);
  check('trainer gets 403 on every money endpoint', trainerStatuses.every((s) => s === 403), trainerStatuses);

  const deskForbidden = [
    ['POST', `/admin/payments/${due._id}/refund`, { reason: 'Test refund' }],
    ['GET', '/admin/payments/export.csv'],
    ['GET', '/admin/finance/overview'],
    ['GET', '/admin/expenses'],
    ['POST', '/admin/expenses', { category: 'rent', amount: 100, date: today }],
  ];
  const deskStatuses = [];
  for (const [method, path, body] of deskForbidden) deskStatuses.push((await call(method, path, { token: D, body, idem: method === 'POST' ? key() : undefined })).status);
  check('front desk gets 403 on refunds, export, revenue and expenses', deskStatuses.every((s) => s === 403), deskStatuses);
  check('front desk can list payments', (await call('GET', '/admin/payments?status=pending', { token: D })).status === 200);
  const deskList = await call('GET', '/admin/payments?status=all', { token: D });
  check('front desk sees dues totals but not revenue or per-mode totals', deskList.body.totals.pending && deskList.body.totals.paid === undefined && deskList.body.totals.byMode === undefined, deskList.body.totals);
  check('staff routes need a session (401)', (await call('GET', '/admin/finance/overview')).status === 401);
  check('member token cannot reach staff payments (403)', (await call('GET', '/admin/payments', { token: memberToken(member._id) })).status === 403);
}

// ── Part payments: each part has its own receipt, the rest stays due, standing and dues stay right
{
  const { member } = await createMember(T, { planId: plan._id, collect: 'later' });
  const [due] = await dueFor(member._id);
  check('sale with pay-later leaves a 1500 due', due?.amount === 1500, due);

  const K1 = key();
  const part1 = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash', amount: 500 }, idem: K1 });
  check(
    'desk collects part of a due',
    part1.status === 200 && part1.body.partial === true && part1.body.payment.amount === 500 && part1.body.payment.status === 'paid' && part1.body.payment.dueId === due._id && part1.body.balance === 1000,
    part1.body
  );
  check('part payment has its own receipt number', part1.body.payment.invoiceNo && part1.body.payment.invoiceNo !== due.invoiceNo, part1.body.payment);
  const replay = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash', amount: 500 }, idem: K1 });
  check('retrying the same part payment replays it', replay.headers.get('idempotent-replayed') === 'true' && replay.body.payment._id === part1.body.payment._id);

  const after1 = (await dueFor(member._id))[0];
  check('the due keeps its id and now shows what is left', after1._id === due._id && after1.amount === 1000 && after1.originalAmount === 1500, after1);
  const standing = await call('GET', `/admin/members/${member._id}`, { token: T });
  check('member standing shows the remaining dues', standing.body.member?.dues === 1000, standing.body.member?.dues);

  const part2 = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'upi', txnRef: 'UPI998877', amount: 600 }, idem: key() });
  check('second part payment', part2.status === 200 && part2.body.balance === 400 && part2.body.payment.invoiceNo > part1.body.payment.invoiceNo, part2.body);

  const over = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash', amount: 401 }, idem: key() });
  check('collecting more than is due is refused (422)', over.status === 422 && over.body.code === 'AMOUNT_TOO_HIGH' && over.body.details?.fields?.amount, over.body);
  const zero = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash', amount: 0 }, idem: key() });
  check('amount 0 is a validation error with a field', zero.status === 422 && zero.body.details?.fields?.amount, zero.body);

  await setPayments({ allowPartial: false });
  const notAllowed = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash', amount: 100 }, idem: key() });
  check('part payments refused when turned off in settings', notAllowed.status === 422 && notAllowed.body.code === 'PARTIAL_NOT_ALLOWED', notAllowed.body);
  await setPayments({ allowPartial: true });

  const receipt = await call('GET', `/admin/payments/${part1.body.payment._id}/receipt`, { token: D, raw: true });
  check('part receipt shows the bill, balance and amount in words', receipt.text.includes(due.invoiceNo) && receipt.text.includes('Balance due after this payment') && receipt.text.includes('Rupees Five Hundred Only'), receipt.text.slice(0, 300));

  const final = await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'card' }, idem: key() });
  check('collecting the rest settles the due', final.status === 200 && final.body.partial === false && final.body.payment._id === due._id && final.body.payment.amount === 400 && final.body.payment.status === 'paid', final.body);
  const detail = await call('GET', `/admin/payments/${due._id}`, { token: D });
  check('bill detail lists its part payments', detail.body.parts?.length === 2 && detail.body.parts.reduce((s, p) => s + p.amount, 0) + detail.body.payment.amount === 1500, detail.body);
  const settled = await call('GET', `/admin/members/${member._id}`, { token: T });
  check('member owes nothing after the last part', settled.body.member?.dues === 0);
}

// ── Part payments on a self-join: the plan starts only when everything is paid
{
  const { member } = await createMember(T);
  const mt = memberToken(member._id);
  const join = await call('POST', '/membership/join', {
    token: mt,
    body: {
      personalDetails: { fullName: member.name, age: 30, gender: 'female', mobile: uniqPhone(), email: `${uniq('join')}@example.com`, address: { city: 'Kota', state: 'RJ' } },
      healthDetails: { heightCm: 160, weightKg: 58, medicalCondition: { has: false } },
      fitnessGoal: { goalKind: 'general_fitness' },
      selectedPlanId: plan._id,
    },
  });
  check('self-join waits for payment', join.status === 201 && join.body.membership?.status === 'pending', join.body);
  const [due] = await dueFor(member._id);
  await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash', amount: 1000 }, idem: key() });
  const mid = await call('GET', '/membership/me', { token: mt });
  check('a part payment does not start the plan', mid.body.membership?.status === 'pending' && mid.body.dues?.amount === 500, { s: mid.body.membership?.status, d: mid.body.dues });
  await call('POST', `/admin/payments/${due._id}/collect`, { token: D, body: { mode: 'cash' }, idem: key() });
  const done = await call('GET', '/membership/me', { token: mt });
  check('paying the rest activates the plan', done.body.membership?.status === 'active' && done.body.dues?.amount === 0, { s: done.body.membership?.status, d: done.body.dues });
  const kinds = await inboxKinds(mt);
  check('member is told the plan is active (in-app)', kinds === null || kinds.includes('membership_active'), kinds);
}

// ── Desk payments: accepted modes, filters, totals per mode, CSV, refunds (excluded from revenue)
let ptPayment;
{
  const { member } = await createMember(T, { planId: plan._id, collect: 'now' });
  await setPayments({ acceptCard: false });
  const card = await call('POST', '/admin/payments', { token: D, body: { memberId: member._id, type: 'personal_training', amount: 2500, mode: 'card' }, idem: key() });
  check('a mode turned off in settings is refused (422)', card.status === 422 && card.body.code === 'MODE_NOT_ACCEPTED' && card.body.details?.fields?.mode, card.body);
  await setPayments({ acceptCard: true });

  const before = await finance();
  const K = key();
  const rec = await call('POST', '/admin/payments', { token: D, body: { memberId: member._id, type: 'personal_training', amount: 2500, mode: 'cash', note: '8 PT sessions' }, idem: K });
  check('desk records a payment', rec.status === 201 && rec.body.payment.status === 'paid', rec.body);
  ptPayment = rec.body.payment;
  const again = await call('POST', '/admin/payments', { token: D, body: { memberId: member._id, type: 'personal_training', amount: 2500, mode: 'cash', note: '8 PT sessions' }, idem: K });
  check('same payment retried is replayed, not recorded twice', again.body.payment._id === ptPayment._id);
  const bad = await call('POST', '/admin/payments', { token: D, body: { memberId: member._id, type: 'gift', amount: -5, mode: 'bitcoin' }, idem: key() });
  check('invalid payment gives 422 with per-field errors', bad.status === 422 && bad.body.details.fields.type && bad.body.details.fields.amount && bad.body.details.fields.mode, bad.body);

  const filtered = await call('GET', `/admin/payments?status=paid&type=personal_training&mode=cash&from=${today}&to=${today}&memberId=${member._id}`, { token: T });
  check('filters by date, mode, type and member', filtered.body.payments.length === 1 && filtered.body.payments[0]._id === ptPayment._id, filtered.body.payments);
  check('owner sees totals per mode', filtered.body.totals.byMode?.cash?.amount === 2500 && filtered.body.totals.paid.amount === 2500, filtered.body.totals);
  const range = await call('GET', `/admin/payments?from=${today}&to=2020-01-01`, { token: T });
  check('a date range that ends before it starts is a 422', range.status === 422 && range.body.details?.fields?.from, range.body);
  const search = await call('GET', `/admin/payments?q=${encodeURIComponent(ptPayment.invoiceNo)}`, { token: D });
  check('search by receipt number', search.body.payments.some((p) => p._id === ptPayment._id));

  const csv = await call('GET', `/admin/payments/export.csv?status=paid&memberId=${member._id}`, { token: M, raw: true });
  check('manager exports payments as CSV', csv.status === 200 && csv.headers.get('content-type').includes('text/csv') && csv.text.includes('Receipt no.,Status,Member') && csv.text.includes(ptPayment.invoiceNo), csv.text?.slice(0, 200));

  const noReason = await call('POST', `/admin/payments/${ptPayment._id}/refund`, { token: M, body: {}, idem: key() });
  check('refund needs a reason (422)', noReason.status === 422 && noReason.body.details?.fields?.reason, noReason.body);
  const RK = key();
  const refund = await call('POST', `/admin/payments/${ptPayment._id}/refund`, { token: M, body: { reason: 'Trainer left, sessions cancelled' }, idem: RK });
  check('manager marks a refund', refund.status === 200 && refund.body.payment.status === 'refunded' && refund.body.payment.refund.amount === 2500, refund.body);
  const refundReplay = await call('POST', `/admin/payments/${ptPayment._id}/refund`, { token: M, body: { reason: 'Trainer left, sessions cancelled' }, idem: RK });
  check('refund retry replays', refundReplay.status === 200 && refundReplay.headers.get('idempotent-replayed') === 'true');
  const refundTwice = await call('POST', `/admin/payments/${ptPayment._id}/refund`, { token: M, body: { reason: 'Again' }, idem: key() });
  check('refunding twice is refused (409)', refundTwice.status === 409 && refundTwice.body.code === 'ALREADY_REFUNDED', refundTwice.body);
  const [dueRow] = await dueFor((await createMember(T, { planId: plan._id, collect: 'later' })).member._id);
  const refundDue = await call('POST', `/admin/payments/${dueRow._id}/refund`, { token: M, body: { reason: 'Nothing was paid' }, idem: key() });
  check('an unpaid due cannot be refunded (409)', refundDue.status === 409 && refundDue.body.code === 'NOT_PAID', refundDue.body);

  const refundedList = await call('GET', `/admin/payments?status=refunded&from=${today}&to=${today}`, { token: T });
  check('refunds show in history', refundedList.body.payments.some((p) => p._id === ptPayment._id && p.refund.reason));
  const after = await finance();
  check(
    'refunded money is excluded from revenue and reported separately',
    after.summary.month.amount === before.summary.month.amount &&
      after.selected.refunds.amount - before.selected.refunds.amount === 2500 &&
      after.byType.find((t) => t.type === 'personal_training').amount === before.byType.find((t) => t.type === 'personal_training').amount,
    { before: before.summary.month, after: after.summary.month, refunds: after.selected.refunds }
  );
  const refundedReceipt = await call('GET', `/admin/payments/${ptPayment._id}/receipt`, { token: D, raw: true });
  check('refunded receipt says so', refundedReceipt.text.includes('Refunded') && refundedReceipt.text.includes('Trainer left'));

  const emailed = await call('POST', `/admin/payments/${ptPayment._id}/send-receipt`, { token: D });
  // The test server has no email settings, so the send really fails; the desk must be told, not "emailed".
  check('a receipt that could not be sent says so and why (422)', emailed.status === 422 && emailed.body.code === 'EMAIL_NOT_SENT' && /not configured/.test(emailed.body.message), emailed.body);
  const noEmailMember = await call('POST', '/admin/members', { token: T, body: { details: { name: uniq('No Email '), phone: uniqPhone() }, force: true }, idem: key() });
  const cashNoEmail = await call('POST', '/admin/payments', { token: D, body: { memberId: noEmailMember.body.member._id, type: 'other', amount: 50, mode: 'cash' }, idem: key() });
  const noEmail = await call('POST', `/admin/payments/${cashNoEmail.body.payment._id}/send-receipt`, { token: D });
  check('emailing a member without email explains what to do (422)', noEmail.status === 422 && noEmail.body.code === 'NO_EMAIL', noEmail.body);
}

// ── UPI without a gateway: member pays the gym's UPI ID and sends the reference; staff verify
{
  const { member } = await createMember(T, { planId: plan._id, collect: 'later' });
  const mt = memberToken(member._id);
  const dues = await call('GET', '/member/payments/dues', { token: mt });
  const due = dues.body.dues?.[0];
  check('member sees their dues and how they can pay', dues.status === 200 && dues.body.totalDue === 1500 && due?.status === 'due' && dues.body.payOptions.upi.available === true && dues.body.payOptions.online.available === false, dues.body);

  const intent = await call('GET', `/member/payments/dues/${due.id}/upi`, { token: mt });
  check(
    'UPI intent link for the due',
    intent.status === 200 && intent.body.upi.link.startsWith('upi://pay?pa=kovij%40okicici&pn=Kovij%20Fitness&am=1500.00&cu=INR') && intent.body.upi.reference === due.invoiceNo,
    intent.body
  );

  const utr = `4${Date.now().toString().slice(-11)}`;
  const UK = key();
  const sent = await call('POST', `/member/payments/dues/${due.id}/upi-reference`, { token: mt, body: { utr: `${utr.slice(0, 6)} ${utr.slice(6)}` }, idem: UK });
  check('member submits the UPI reference; the due awaits verification', sent.status === 200 && sent.body.due.status === 'awaiting_verification' && sent.body.due.verification.utr === utr, sent.body);
  const sentAgain = await call('POST', `/member/payments/dues/${due.id}/upi-reference`, { token: mt, body: { utr: `${utr.slice(0, 6)} ${utr.slice(6)}` }, idem: UK });
  check('resubmitting with the same key replays', sentAgain.status === 200 && sentAgain.headers.get('idempotent-replayed') === 'true');
  const second = await call('POST', `/member/payments/dues/${due.id}/upi-reference`, { token: mt, body: { utr: '999988887777' }, idem: key() });
  check('a second, different reference is refused while one is waiting (409)', second.status === 409 && second.body.code === 'ALREADY_SUBMITTED', second.body);
  const badUtr = await call('POST', `/member/payments/dues/${due.id}/upi-reference`, { token: mt, body: { utr: '12' }, idem: key() });
  check('a malformed reference is a 422 on the utr field', badUtr.status === 422 && badUtr.body.details?.fields?.utr, badUtr.body);

  const other = await createMember(T, { planId: plan._id, collect: 'later' });
  const otherDue = (await call('GET', '/member/payments/dues', { token: other.token })).body.dues[0];
  const reused = await call('POST', `/member/payments/dues/${otherDue.id}/upi-reference`, { token: other.token, body: { utr }, idem: key() });
  check('the same reference cannot pay two bills (409)', reused.status === 409 && reused.body.code === 'UTR_ALREADY_USED', reused.body);
  check("a member can't act on someone else's bill (404)", (await call('GET', `/member/payments/dues/${due.id}/upi`, { token: other.token })).status === 404);

  const queue = await call('GET', '/admin/payments?status=awaiting', { token: D });
  check('staff verify queue lists it', queue.body.payments.some((p) => p._id === due.id && p.verification.utr === utr) && queue.body.totals.awaitingCount >= 1, queue.body.totals);

  const rejectNoReason = await call('POST', `/admin/payments/${due.id}/verify`, { token: D, body: { decision: 'reject' }, idem: key() });
  check('rejecting needs a reason (422)', rejectNoReason.status === 422 && rejectNoReason.body.details?.fields?.reason, rejectNoReason.body);
  const rejected = await call('POST', `/admin/payments/${due.id}/verify`, { token: D, body: { decision: 'reject', reason: 'No payment with this reference in the bank app' }, idem: key() });
  check('desk rejects a reference it cannot find', rejected.status === 200 && rejected.body.due.verification.state === 'rejected', rejected.body);
  const afterReject = (await call('GET', '/member/payments/dues', { token: mt })).body.dues[0];
  check('member sees the bill as due again, with the reason', afterReject.status === 'due' && afterReject.verification.reason.includes('bank app'), afterReject);

  const utr2 = `5${Date.now().toString().slice(-11)}`;
  await call('POST', `/member/payments/dues/${due.id}/upi-reference`, { token: mt, body: { utr: utr2 }, idem: key() });
  const VK = key();
  const confirmed = await call('POST', `/admin/payments/${due.id}/verify`, { token: D, body: { decision: 'confirm' }, idem: VK });
  check(
    'desk confirms: the due is collected as UPI with that reference',
    confirmed.status === 200 && confirmed.body.payment.status === 'paid' && confirmed.body.payment.mode === 'upi' && confirmed.body.payment.txnRef === utr2,
    confirmed.body
  );
  const confirmedAgain = await call('POST', `/admin/payments/${due.id}/verify`, { token: D, body: { decision: 'confirm' }, idem: key() });
  check('confirming twice is refused (409)', confirmedAgain.status === 409 && confirmedAgain.body.code === 'ALREADY_PAID', confirmedAgain.body);

  const history = await call('GET', '/member/payments', { token: mt });
  const paidRow = history.body.payments?.find((p) => p.id === due.id);
  check('member history shows the paid bill with its receipt number', history.status === 200 && paidRow?.status === 'paid' && paidRow.invoiceNo === due.invoiceNo && paidRow.receiptAvailable && history.body.totalPaid >= 1500, history.body);
  const mine = await call('GET', `/member/payments/${due.id}/receipt`, { token: mt, raw: true });
  check('member opens their own receipt', mine.status === 200 && mine.text.includes(due.invoiceNo) && mine.text.includes('Payment receipt'));
  const json = await call('GET', `/member/payments/${due.id}/receipt?format=json`, { token: mt });
  check('receipt is also available as JSON for the app', json.body.success && json.body.html.includes(due.invoiceNo));
  check("another member can't open it (404)", (await call('GET', `/member/payments/${due.id}/receipt`, { token: other.token })).status === 404);
  check('no receipt for an unpaid bill (409)', (await call('GET', `/member/payments/${otherDue.id}/receipt`, { token: other.token })).status === 409);
  check('member views one payment', (await call('GET', `/member/payments/${due.id}`, { token: mt })).body.payment?.status === 'paid');
  // No email settings on the test server: the member is told it didn't go, in plain words.
  const copy = await call('POST', `/member/payments/${due.id}/email-receipt`, { token: mt });
  check('member asking for a copy hears it could not be emailed', copy.status === 422 && copy.body.code === 'EMAIL_NOT_SENT' && /couldn't email/.test(copy.body.message), copy.body);
  const kinds = await inboxKinds(mt);
  check('member was told about the rejection and got the receipt (in-app)', kinds === null || (kinds.includes('payment_verification') && kinds.includes('receipt')), kinds);
  check('legacy portal list still works', (await call('GET', '/payments/me', { token: mt })).body.payments?.some((p) => p._id === due.id));
  check('legacy portal bill still works', (await call('GET', `/payments/${due.id}/bill`, { token: mt, raw: true })).text?.includes(due.invoiceNo));

  await setPayments({ acceptUpi: false });
  const upiOff = await call('GET', `/member/payments/dues/${otherDue.id}/upi`, { token: other.token });
  check('UPI turned off gives 409 UPI_NOT_SET_UP', upiOff.status === 409 && upiOff.body.code === 'UPI_NOT_SET_UP', upiOff.body);
  await setPayments({ acceptUpi: true });
}

// ── Online (Razorpay): off without keys; webhook refuses anything unsigned
{
  const status = await call('GET', '/admin/payments/online-status', { token: D });
  check('online status says keys are missing and never includes secrets', status.status === 200 && status.body.gateway.configured === false && !JSON.stringify(status.body).match(/secret|keySecret/i), status.body);
  const { member, token: mt } = await createMember(T, { planId: plan._id, collect: 'later' });
  const [due] = await dueFor(member._id);
  const order = await call('POST', `/member/payments/dues/${due._id}/online-order`, { token: mt, idem: key() });
  check('online order without gateway keys is 409 ONLINE_PAYMENTS_OFF', order.status === 409 && order.body.code === 'ONLINE_PAYMENTS_OFF' && order.body.message, order.body);
  const verify = await call('POST', '/member/payments/online/verify', { token: mt, body: { razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'a'.repeat(64) } });
  check('online verify without gateway keys is 409', verify.status === 409 && verify.body.code === 'ONLINE_PAYMENTS_OFF', verify.body);
  const badVerify = await call('POST', '/member/payments/online/verify', { token: mt, body: { razorpay_order_id: 'order_x' } });
  check('online verify validates its input (422)', badVerify.status === 422, badVerify.body);

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const unsigned = await call('POST', '/webhooks/razorpay', { body: { event: 'payment.captured' } });
  check('webhook refuses unsigned calls', webhookSecret ? unsigned.status === 400 : unsigned.status === 503, unsigned.body);

  // With a webhook secret in the environment, run the full capture path against a seeded order.
  if (webhookSecret && process.env.MONGO_URI) {
    const crypto = await import('node:crypto');
    // Resolves server/node_modules/mongoose (the server's own copy).
    const mongoose = require('mongoose');
    const conn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
    const orderId = `order_${uniq('e2e')}`;
    await conn.db.collection('paymentorders').insertOne({ provider: 'razorpay', orderId, paymentId: new mongoose.Types.ObjectId(due._id), memberId: new mongoose.Types.ObjectId(member._id), amount: 1500, currency: 'INR', status: 'created', createdAt: new Date(), updatedAt: new Date() });
    const send = async (payId, amount = 150000) => {
      const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: payId, order_id: orderId, amount, currency: 'INR', status: 'captured', method: 'upi' } } } });
      const sig = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
      const res = await fetch(`${process.env.E2E_API}/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sig }, body: raw });
      return { status: res.status, body: await res.json() };
    };
    const payId = `pay_${uniq('e2e')}`;
    const [w1, w2] = await Promise.all([send(payId), send(payId)]);
    check('signed webhook records the payment exactly once (concurrent deliveries)', [w1, w2].filter((w) => w.body.recorded).length === 1 && [w1, w2].every((w) => w.status === 200), [w1, w2]);
    const w3 = await send(payId);
    check('webhook redelivery is a replay', w3.body.replayed === true, w3.body);
    const paid = await call('GET', `/admin/payments/${due._id}`, { token: T });
    check('due is paid online with the gateway id', paid.body.payment.status === 'paid' && paid.body.payment.mode === 'online' && paid.body.payment.gateway.paymentId === payId, paid.body.payment);
    const extra = await send(`pay_${uniq('e2e2')}`);
    const flagged = await call('GET', `/admin/payments?status=paid&memberId=${member._id}&mode=online`, { token: T });
    check('a second payment on the same order is recorded for review, not lost', extra.body.recorded === true && flagged.body.payments.some((p) => p.meta?.needsReview), flagged.body.payments);
    const forged = await fetch(`${process.env.E2E_API}/webhooks/razorpay`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'f'.repeat(64) }, body: '{"event":"payment.captured"}' });
    check('webhook with a wrong signature is 400', forged.status === 400);
    await conn.close();
  } else {
    console.log('(webhook capture path skipped: set RAZORPAY_WEBHOOK_SECRET to run it)');
  }
}

// ── Expenses
let expense;
{
  const bad = await call('POST', '/admin/expenses', { token: M, body: { category: 'party', amount: 0, date: '2999-01-01' }, idem: key() });
  check('expense validation: category, amount and date fields (422)', bad.status === 422 && bad.body.details.fields.category && bad.body.details.fields.amount && bad.body.details.fields.date, bad.body);
  const EK = key();
  const vendor = uniq('Sharma Estates ');
  const created = await call('POST', '/admin/expenses', { token: M, body: { category: 'rent', amount: 25000, date: today, mode: 'bank', vendor, note: 'September rent' }, idem: EK });
  check('manager adds an expense', created.status === 201 && created.body.expense.amount === 25000 && created.body.expense.date === today && created.body.expense.bill === null, created.body);
  expense = created.body.expense;
  const dup = await call('POST', '/admin/expenses', { token: M, body: { category: 'rent', amount: 25000, date: today, mode: 'bank', vendor, note: 'September rent' }, idem: EK });
  check('double tap does not add it twice', dup.body.expense._id === expense._id);
  await call('POST', '/admin/expenses', { token: T, body: { category: 'electricity', amount: 4200.5, date: today, mode: 'upi', vendor: 'JVVNL' }, idem: key() });

  const list = await call('GET', `/admin/expenses?month=${thisMonth}`, { token: T });
  check('month list with totals by category', list.status === 200 && list.body.items.some((e) => e._id === expense._id) && list.body.totals.byCategory.rent.amount >= 25000 && list.body.totals.byCategory.electricity.amount >= 4200.5, list.body.totals);
  const byCat = await call('GET', `/admin/expenses?month=${thisMonth}&category=electricity`, { token: T });
  check('filter by category', byCat.body.items.every((e) => e.category === 'electricity') && byCat.body.totals.byCategory.rent, byCat.body.totals);
  const searched = await call('GET', `/admin/expenses?q=${encodeURIComponent(vendor)}`, { token: T });
  check('search by vendor', searched.body.items.length === 1 && searched.body.items[0]._id === expense._id);

  const edited = await call('PATCH', `/admin/expenses/${expense._id}`, { token: M, body: { amount: 26000, note: '' } });
  check('edit an expense (and clear a note)', edited.status === 200 && edited.body.expense.amount === 26000 && edited.body.expense.note === '', edited.body);
  check('empty edit is a 422', (await call('PATCH', `/admin/expenses/${expense._id}`, { token: M, body: {} })).status === 422);

  const form = new FormData();
  form.append('bill', new Blob(['%PDF-1.4 test bill'], { type: 'application/pdf' }), 'rent-sept.pdf');
  const up = await call('PUT', `/admin/expenses/${expense._id}/bill`, { token: M, body: form });
  check('attach a PDF bill (private; no file path in the response)', up.status === 200 && up.body.expense.bill?.name === 'rent-sept.pdf' && !JSON.stringify(up.body).includes('private:'), up.body);
  const dl = await call('GET', `/admin/expenses/${expense._id}/bill`, { token: M, raw: true });
  check('bill streams back to managers only', dl.status === 200 && dl.headers.get('content-type') === 'application/pdf' && dl.text.startsWith('%PDF') && dl.headers.get('cache-control').includes('no-store'));
  check('front desk cannot download bills (403)', (await call('GET', `/admin/expenses/${expense._id}/bill`, { token: D })).status === 403);
  const wrongType = new FormData();
  wrongType.append('bill', new Blob(['hello'], { type: 'text/plain' }), 'x.txt');
  const badUp = await call('PUT', `/admin/expenses/${expense._id}/bill`, { token: M, body: wrongType });
  check('a non-photo, non-PDF bill is refused (422)', badUp.status === 422 && badUp.body.details?.fields?.bill, badUp.body);
  const rmBill = await call('DELETE', `/admin/expenses/${expense._id}/bill`, { token: M });
  check('remove the bill', rmBill.status === 200 && rmBill.body.expense.bill === null);

  const ecsv = await call('GET', `/admin/expenses/export.csv?month=${thisMonth}`, { token: T, raw: true });
  check('expenses CSV export', ecsv.status === 200 && ecsv.text.includes('Date,Category,Amount (INR)') && ecsv.text.includes(vendor), ecsv.text?.slice(0, 200));
}

// ── Revenue overview
{
  const fin = await call('GET', `/admin/finance/overview?month=${thisMonth}`, { token: M });
  const b = fin.body;
  const dayOfMonth = Number(today.slice(8));
  check('manager sees the revenue overview', fin.status === 200 && b.month === thisMonth && b.summary.today.amount > 0 && b.summary.month.amount >= b.summary.today.amount && b.summary.year.amount >= b.summary.month.amount, b.summary);
  check('daily bars run to today; 12 months of trend', b.daily.length === dayOfMonth && b.daily.at(-1).day === today && b.monthly.length === 12 && b.monthly.at(-1).month === thisMonth, { d: b.daily?.length, m: b.monthly?.length });
  check('breakdowns by mode and type add up to the month', Math.abs(b.byMode.reduce((s, r) => s + r.amount, 0) - b.selected.collected) < 0.01 && Math.abs(b.byType.reduce((s, r) => s + r.amount, 0) - b.selected.collected) < 0.01, { modes: b.byMode, collected: b.selected.collected });
  check('UPI and card collections show in the mode breakdown', b.byMode.find((r) => r.mode === 'upi').amount >= 1500 && b.byMode.find((r) => r.mode === 'card').amount >= 400);
  check('expenses and net for the month', b.selected.expenses >= 30200.5 && Math.abs(b.selected.net - (b.selected.collected - b.selected.expenses)) < 0.01, b.selected);
  check('outstanding dues with ageing buckets', b.outstanding.ageing.length === 3 && b.outstanding.ageing[0].amount === b.outstanding.total && b.outstanding.count > 0, b.outstanding);
  check('invalid month is a 422', (await call('GET', '/admin/finance/overview?month=2026-13', { token: M })).status === 422);
  const past = await call('GET', '/admin/finance/overview?month=2020-02', { token: M });
  check('a past month shows every day of that month', past.body.daily.length === 29 && past.body.selected.collected === 0, past.body.daily?.length);

  const del = await call('DELETE', `/admin/expenses/${expense._id}`, { token: M });
  check('delete an expense', del.status === 200);
  check('deleted expense is gone from lists (404 on open)', (await call('GET', `/admin/expenses/${expense._id}`, { token: M })).status === 404);
  const fin2 = await call('GET', `/admin/finance/overview?month=${thisMonth}`, { token: M });
  check('deleted expense no longer counts', Math.abs(b.selected.expenses - fin2.body.selected.expenses - 26000) < 0.01, { before: b.selected.expenses, after: fin2.body.selected.expenses });
}

// Leave shared settings as other flows expect them.
await call('PATCH', '/admin/settings', { token: T, body: { registrationFee: initial.registrationFee ?? 0, payments: initial.payments } });

finish();
