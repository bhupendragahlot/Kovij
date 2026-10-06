// Email delivery: the owner's Settings → Email status and test send, and that every member
// notification's email status ends as the real outcome (the test server has no email settings,
// so sends fail with "not configured"; nothing ever reaches a real inbox).
import { adminToken, call, check, createMember, createPlan, finish, staffToken } from '../lib.mjs';

const T = await adminToken();
const manager = await staffToken('manager', T);
const desk = await staffToken('staff', T);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Settings → Email (owner only) ──────────────────────────────────────────
for (const [who, token] of [['manager', manager.token], ['front desk', desk.token]]) {
  check(`${who} cannot see email settings (403)`, (await call('GET', '/admin/settings/email', { token })).status === 403);
  check(`${who} cannot send a test email (403)`, (await call('POST', '/admin/settings/email/test', { token, body: {} })).status === 403);
}
const setup = await call('GET', '/admin/settings/email', { token: T });
check(
  'owner sees how email is set up and what is missing',
  setup.status === 200 && setup.body.email.configured === false && setup.body.email.provider === 'smtp' && setup.body.email.missing.join() === 'EMAIL_USER,EMAIL_PASS' && setup.body.defaultTo.includes('@'),
  setup.body
);
check('no password or key in the answer', !/pass"\s*:|apiKey|brevoKey/i.test(JSON.stringify(setup.body)), setup.body);

const started = Date.now();
const test = await call('POST', '/admin/settings/email/test', { token: T, body: {} });
check(
  'test email reports the real failure, quickly',
  test.status === 200 && test.body.ok === false && test.body.status === 'failed' && /not configured.*EMAIL_USER and EMAIL_PASS/.test(test.body.error) && Date.now() - started < 10_000,
  { body: test.body, ms: Date.now() - started }
);
const badTo = await call('POST', '/admin/settings/email/test', { token: T, body: { to: 'not-an-email' } });
check('test address is checked (422)', badTo.status === 422 && badTo.body.details.fields.to, badTo.body);
const after = await call('GET', '/admin/settings/email', { token: T });
check('last week’s failures and the latest reason are shown', after.body.lastWeek.failed >= 1 && /not configured/.test(after.body.lastFailure?.error || ''), after.body);

// ── Member notifications end with the real email outcome ───────────────────
const plan = await createPlan(T);
const { member, sale, token: memberToken } = await createMember(T, { planId: plan._id });
const paymentId = sale?.payments?.[0]?._id;
check('member with an email and a paid plan', Boolean(member.email && paymentId), { email: member.email, sale });

const receipt = await call('POST', `/admin/payments/${paymentId}/send-receipt`, { token: T });
check('desk is told the receipt was not emailed, and why', receipt.status === 422 && receipt.body.code === 'EMAIL_NOT_SENT' && /not configured/.test(receipt.body.message), receipt.body);

let note;
for (let i = 0; i < 20 && !note; i += 1) {
  // Staff view of the member's messages, with delivery details per channel.
  const h = await call('GET', `/admin/notifications?memberId=${member._id}&kind=receipt`, { token: T });
  note = h.body?.items?.find((n) => n.channels?.email?.status && n.channels.email.status !== 'queued');
  if (!note) await sleep(150);
}
check('the receipt notification shows the email failed (not stuck on "queued")', note?.channels?.email?.status === 'failed' && /not configured/.test(note.channels.email.reason), note?.channels);

const direct = await call('POST', `/admin/members/${member._id}/notify`, { token: T, body: { subject: 'Hello', bodyHtml: '<p>Test</p>' } });
check('a direct email to a member reports the failure (422)', direct.status === 422 && direct.body.code === 'EMAIL_NOT_SENT' && /not configured/.test(direct.body.message), direct.body);

const mine = await call('POST', `/member/payments/${paymentId}/email-receipt`, { token: memberToken });
check('a member asking for a copy gets a plain answer, no server details', mine.status === 422 && /couldn't email the receipt/.test(mine.body.message) && !/EMAIL_USER/.test(mine.body.message), mine.body);


finish();
