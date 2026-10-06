/**
 * Email delivery (services/emailService.js) without a database or a mail server: provider choice,
 * SMTP options, the Brevo request, and errors explained in plain words.
 */
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverEmail, emailConfig, emailStatus, explainSendError, setEmailFetch, smtpOptions } from '../services/emailService.js';

const KEYS = ['EMAIL_PROVIDER', 'BREVO_API_KEY', 'BREVO_API_URL', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'SMTP_HOST', 'SMTP_PORT'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
function useEnv(env) {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
}
afterEach(() => {
  setEmailFetch();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── Which provider ─────────────────────────────────────────────────────────

test('Gmail SMTP by default; Brevo as soon as its key is set; EMAIL_PROVIDER wins', () => {
  const gmail = emailConfig({ EMAIL_USER: 'gym@gmail.com', EMAIL_PASS: 'abcd efgh ijkl mnop' });
  assert.equal(gmail.provider, 'smtp');
  assert.equal(gmail.configured, true);
  assert.equal(gmail.fromAddress, 'gym@gmail.com');
  const brevo = emailConfig({ BREVO_API_KEY: 'k', EMAIL_USER: 'gym@gmail.com', EMAIL_PASS: 'x' });
  assert.equal(brevo.provider, 'brevo');
  assert.equal(brevo.configured, true);
  assert.equal(emailConfig({ BREVO_API_KEY: 'k', EMAIL_PROVIDER: 'SMTP', EMAIL_USER: 'a@b.c', EMAIL_PASS: 'p' }).provider, 'smtp');
  assert.equal(emailConfig({ BREVO_API_KEY: 'k', EMAIL_FROM: 'desk@kovij.in', EMAIL_USER: 'gym@gmail.com' }).fromAddress, 'desk@kovij.in');
});

test('what is missing is named, so the owner knows what to add', () => {
  assert.deepEqual(emailConfig({}).missing, ['EMAIL_USER', 'EMAIL_PASS']);
  assert.deepEqual(emailConfig({ EMAIL_USER: 'a@b.c', EMAIL_PASS: '   ' }).missing, ['EMAIL_PASS']);
  assert.deepEqual(emailConfig({ EMAIL_PROVIDER: 'brevo' }).missing, ['BREVO_API_KEY', 'EMAIL_FROM']);
  assert.equal(emailConfig({}).configured, false);
});

test('the status shown on screen never contains the password or API key', () => {
  useEnv({ EMAIL_USER: 'gym@gmail.com', EMAIL_PASS: 'secretpassword', BREVO_API_KEY: 'xkeysib-secret', EMAIL_PROVIDER: 'smtp' });
  const shown = JSON.stringify(emailStatus());
  assert.ok(!shown.includes('secretpassword') && !shown.includes('xkeysib-secret'), shown);
  assert.deepEqual(emailStatus(), { provider: 'smtp', configured: true, missing: [], from: 'gym@gmail.com', fromName: 'Kovij Fitness Zone', server: 'smtp.gmail.com' });
});

// ── SMTP ───────────────────────────────────────────────────────────────────

test('Gmail App Passwords are used without the spaces Google shows them with', () => {
  const o = smtpOptions(emailConfig({ EMAIL_USER: 'gym@gmail.com', EMAIL_PASS: 'abcd efgh ijkl mnop' }));
  assert.equal(o.service, 'gmail');
  assert.equal(o.auth.pass, 'abcdefghijklmnop');
});

test('SMTP gives up connecting in seconds (blocked ports must not hang for minutes)', () => {
  const o = smtpOptions(emailConfig({ EMAIL_USER: 'a@b.c', EMAIL_PASS: 'p' }));
  assert.ok(o.connectionTimeout <= 15_000 && o.greetingTimeout <= 15_000, o);
});

test('another SMTP server: host, port, TLS mode, password kept exactly', () => {
  const o = smtpOptions(emailConfig({ SMTP_HOST: 'smtp.zoho.in', SMTP_PORT: '465', EMAIL_USER: 'desk@kovij.in', EMAIL_PASS: 'pass with spaces' }));
  assert.deepEqual([o.host, o.port, o.secure, o.auth.pass, o.service], ['smtp.zoho.in', 465, true, 'pass with spaces', undefined]);
  const plain = smtpOptions(emailConfig({ SMTP_HOST: 'smtp.example.com', EMAIL_USER: 'u', EMAIL_PASS: 'p' }));
  assert.deepEqual([plain.port, plain.secure], [587, false]);
});

// ── Errors in plain words ──────────────────────────────────────────────────

const smtp = emailConfig({ EMAIL_USER: 'gym@gmail.com', EMAIL_PASS: 'p' });
const brevo = emailConfig({ BREVO_API_KEY: 'k', EMAIL_FROM: 'gym@gmail.com' });

test('a blocked or unreachable mail port is explained (and retried)', () => {
  for (const err of [Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }), Object.assign(new Error('connect ENETUNREACH'), { code: 'ESOCKET' }), new Error('Greeting never received')]) {
    const e = explainSendError(err, smtp);
    assert.match(e.message, /Couldn't connect to smtp\.gmail\.com.*Render's free plan.*BREVO_API_KEY/);
    assert.equal(e.permanent, false);
  }
});

test('a rejected Gmail password says to use an App Password (and is not retried)', () => {
  const e = explainSendError(Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), { code: 'EAUTH', responseCode: 535 }), smtp);
  assert.match(e.message, /App Password/);
  assert.match(e.message, /535/, 'keeps the original text for diagnosis');
  assert.equal(e.permanent, true);
});

test('Brevo answers: bad key, unverified sender, out of credits, unreachable', () => {
  const key = explainSendError(Object.assign(new Error('Key not found'), { httpStatus: 401, code: 'unauthorized' }), brevo);
  assert.match(key.message, /BREVO_API_KEY/);
  assert.equal(key.permanent, true);
  const sender = explainSendError(Object.assign(new Error('Sender gym@gmail.com is not valid'), { httpStatus: 400, code: 'invalid_parameter' }), brevo);
  assert.match(sender.message, /verify it under Senders/);
  assert.equal(sender.permanent, true);
  assert.equal(explainSendError(Object.assign(new Error('Not enough credits'), { httpStatus: 402, code: 'not_enough_credits' }), brevo).permanent, false);
  assert.equal(explainSendError(Object.assign(new Error('timed out'), { name: 'TimeoutError' }), brevo).permanent, false);
});

// ── Sending ────────────────────────────────────────────────────────────────

test('no email settings: a clear "not configured" error, not retried', async () => {
  useEnv({});
  await assert.rejects(deliverEmail({ to: 'm@example.com', subject: 's', html: '<p>h</p>' }), (e) => /not configured.*EMAIL_USER and EMAIL_PASS/.test(e.message) && e.permanent === true);
});

test('Brevo: one HTTPS POST with the key in a header, the verified sender and the HTML', async () => {
  useEnv({ BREVO_API_KEY: 'xkeysib-test', EMAIL_FROM: 'desk@kovij.in', EMAIL_FROM_NAME: 'Kovij Gym' });
  const calls = [];
  setEmailFetch(async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ messageId: '<1@smtp-relay.brevo.com>' }), { status: 201 });
  });
  await deliverEmail({ to: 'member@example.com', subject: 'Your receipt', html: '<p>Paid</p>' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['api-key'], 'xkeysib-test');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    sender: { email: 'desk@kovij.in', name: 'Kovij Gym' },
    to: [{ email: 'member@example.com' }],
    subject: 'Your receipt',
    htmlContent: '<p>Paid</p>',
  });
});

test('Brevo refusing the key is reported as a permanent, explained failure', async () => {
  useEnv({ BREVO_API_KEY: 'bad', EMAIL_FROM: 'desk@kovij.in' });
  setEmailFetch(async () => new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 }));
  await assert.rejects(deliverEmail({ to: 'm@example.com', subject: 's', html: 'h' }), (e) => /Brevo refused BREVO_API_KEY.*Key not found/.test(e.message) && e.permanent === true);
});
