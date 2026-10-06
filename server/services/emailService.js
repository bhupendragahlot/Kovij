import { AsyncLocalStorage } from 'node:async_hooks';
import nodemailer from 'nodemailer';
import PQueue from 'p-queue';
import EmailLog from '../models/EmailLog.js';
import Notification from '../models/Notification.js';
import { renderTemplate } from './emailTemplates/index.js';
import { logger } from '../utils/logger.js';

/**
 * Sending email. Every email is logged (EmailLog) with its real outcome, and a member
 * notification's email status follows that outcome.
 *
 * Two ways to send, chosen by EMAIL_PROVIDER ("brevo" or "smtp"), or automatically: Brevo when
 * BREVO_API_KEY is set, otherwise SMTP.
 *   smtp   Gmail by default: EMAIL_USER + EMAIL_PASS (a 16-letter Google App Password). SMTP_HOST,
 *          SMTP_PORT for another mail server. Needs outbound ports 465/587, which some hosts block:
 *          Render's free plan has blocked all outbound SMTP since September 2025.
 *   brevo  Brevo's HTTPS API (port 443, works on any host): BREVO_API_KEY, and EMAIL_FROM (or
 *          EMAIL_USER) as the sender, which must be a verified sender in Brevo.
 * EMAIL_FROM_NAME sets the sender name (default "Kovij Fitness Zone").
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const SEND_TIMEOUT_MS = 20_000;
const queue = new PQueue({ concurrency: 3 });

/**
 * Lets a caller learn which EmailLog a nested queueEmail() created, without threading ids
 * through code it doesn't own. services/memberNotifier.js uses it.
 */
export const emailTracking = new AsyncLocalStorage();

const trim = (v) => String(v ?? '').trim();

export function emailConfig(env = process.env) {
  const brevoKey = trim(env.BREVO_API_KEY);
  const user = trim(env.EMAIL_USER);
  const pass = String(env.EMAIL_PASS ?? '');
  const asked = trim(env.EMAIL_PROVIDER).toLowerCase();
  const provider = asked === 'smtp' || asked === 'brevo' ? asked : brevoKey ? 'brevo' : 'smtp';
  const smtpHost = trim(env.SMTP_HOST);
  const fromAddress = trim(env.EMAIL_FROM) || user;
  const missing =
    provider === 'brevo'
      ? [!brevoKey && 'BREVO_API_KEY', !fromAddress && 'EMAIL_FROM'].filter(Boolean)
      : [!user && 'EMAIL_USER', !pass.trim() && 'EMAIL_PASS'].filter(Boolean);
  return {
    provider,
    configured: missing.length === 0,
    missing,
    fromAddress,
    fromName: trim(env.EMAIL_FROM_NAME) || 'Kovij Fitness Zone',
    brevoKey,
    brevoUrl: trim(env.BREVO_API_URL) || BREVO_API_URL,
    user,
    pass,
    smtpHost,
    smtpPort: Number(env.SMTP_PORT) || (smtpHost ? 587 : 465),
  };
}

export const isEmailConfigured = () => emailConfig().configured;

/** For the Settings screen: how email is set up. Never includes a key or password. */
export function emailStatus() {
  const c = emailConfig();
  return {
    provider: c.provider,
    configured: c.configured,
    missing: c.missing,
    from: c.fromAddress,
    fromName: c.fromName,
    server: c.provider === 'brevo' ? 'api.brevo.com' : c.smtpHost || 'smtp.gmail.com',
  };
}

/** Where the gym's own notices go when Settings has no email (e.g. website enquiries). */
export const gymInbox = (settingsEmail) => trim(settingsEmail) || emailConfig().fromAddress;

// ── SMTP ───────────────────────────────────────────────────────────────────

/** nodemailer options for the SMTP settings (exported for tests). */
export function smtpOptions(c) {
  const server = c.smtpHost ? { host: c.smtpHost, port: c.smtpPort, secure: c.smtpPort === 465 } : { service: 'gmail' };
  return {
    ...server,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Fail in seconds, not minutes, when the host blocks mail ports.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: {
      user: c.user,
      // Google shows App Passwords in groups of four ("abcd efgh ijkl mnop"); the spaces aren't part of it.
      pass: c.smtpHost ? c.pass : c.pass.replace(/\s+/g, ''),
    },
  };
}

let transport = null;
let transportKey = '';
function smtpTransport(c) {
  const key = JSON.stringify([c.smtpHost, c.smtpPort, c.user, c.pass]);
  if (!transport || key !== transportKey) {
    transport?.close?.();
    transport = nodemailer.createTransport(smtpOptions(c));
    transportKey = key;
  }
  return transport;
}

// ── Brevo ──────────────────────────────────────────────────────────────────

let fetchImpl = (...args) => fetch(...args);
/** Tests swap in a fake fetch; call with no argument to restore the real one. */
export function setEmailFetch(fn) {
  fetchImpl = fn || ((...args) => fetch(...args));
}

async function sendViaBrevo(c, { to, subject, html }) {
  const res = await fetchImpl(c.brevoUrl, {
    method: 'POST',
    headers: { 'api-key': c.brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ sender: { email: c.fromAddress, name: c.fromName }, to: [{ email: to }], subject, htmlContent: html }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  const err = new Error(body.message || `Brevo answered ${res.status}`);
  err.httpStatus = res.status;
  err.code = body.code || `HTTP_${res.status}`;
  throw err;
}

// ── Errors in plain words ──────────────────────────────────────────────────

const CONNECT_CODES = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'ENOTFOUND']);

/**
 * What went wrong, for the email log and the Settings screen. `permanent` errors (bad password,
 * unverified sender) are not retried: trying again can't fix them.
 */
export function explainSendError(err, c = emailConfig()) {
  const raw = String(err?.message || err || 'Unknown error').slice(0, 200);
  const detail = (text) => `${text} (${raw})`;
  if (err?.code === 'NOT_CONFIGURED') return { message: raw, permanent: true };
  if (c.provider === 'brevo') {
    if (err?.httpStatus === 401 || err?.code === 'unauthorized') return { message: detail('Brevo refused BREVO_API_KEY. Create a new API key in Brevo and set it again.'), permanent: true };
    if (err?.httpStatus === 400 && /sender/i.test(raw)) return { message: detail(`Brevo won't send from ${c.fromAddress}. Add and verify it under Senders in Brevo, or set EMAIL_FROM to a verified sender.`), permanent: true };
    if (err?.code === 'not_enough_credits') return { message: detail("Brevo's sending limit is used up for now (the free plan sends 300 a day)."), permanent: false };
    if (err?.httpStatus >= 400 && err?.httpStatus < 500 && err?.httpStatus !== 429) return { message: detail('Brevo refused this email.'), permanent: true };
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || CONNECT_CODES.has(err?.cause?.code)) return { message: detail("Couldn't reach Brevo."), permanent: false };
    return { message: raw, permanent: false };
  }
  const server = c.smtpHost || 'smtp.gmail.com';
  if (err?.code === 'EAUTH' || err?.responseCode === 535 || err?.responseCode === 534) {
    return {
      message: detail(
        c.smtpHost
          ? `${server} refused EMAIL_USER / EMAIL_PASS.`
          : 'Gmail refused EMAIL_USER / EMAIL_PASS. EMAIL_PASS must be a 16-letter App Password (Google Account, Security, App passwords), not the normal Gmail password.'
      ),
      permanent: true,
    };
  }
  if (CONNECT_CODES.has(err?.code) || /timeout|greeting never received|connection closed/i.test(raw)) {
    return {
      message: detail(`Couldn't connect to ${server}. This server's host may block email ports; Render's free plan does. Set BREVO_API_KEY to send over HTTPS instead, or move to a paid plan.`),
      permanent: false,
    };
  }
  return { message: raw, permanent: false };
}

// ── Sending ────────────────────────────────────────────────────────────────

/** Send one email now with the configured provider. Throws an explained error (`permanent` set if retrying is pointless). */
export async function deliverEmail({ to, subject, html }) {
  const c = emailConfig();
  try {
    if (!c.configured) {
      const err = new Error(`Email is not configured on the server: add ${c.missing.join(' and ')}.`);
      err.code = 'NOT_CONFIGURED';
      throw err;
    }
    if (c.provider === 'brevo') await sendViaBrevo(c, { to, subject, html });
    else await smtpTransport(c).sendMail({ from: { name: c.fromName, address: c.fromAddress }, to, subject, html });
  } catch (e) {
    const { message, permanent } = explainSendError(e, c);
    const err = new Error(message);
    err.permanent = permanent;
    throw err;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Copy a finished email's outcome onto its member notification. */
export async function syncNotificationEmail(log) {
  if (!log?.notificationId || log.status === 'queued') return;
  const failed = log.status === 'failed';
  await Notification.updateOne(
    { _id: log.notificationId },
    {
      $set: {
        'channels.email': {
          status: failed ? 'failed' : 'sent',
          reason: failed ? String(log.lastError || 'send_failed').slice(0, 200) : '',
          at: log.sentAt || new Date(),
        },
      },
    }
  );
}

/** Attach an email to its notification after the fact; syncs at once if the email already finished. */
export async function linkEmailToNotification(logId, notificationId) {
  const log = await EmailLog.findByIdAndUpdate(logId, { $set: { notificationId } }, { new: true }).lean();
  if (log && log.status !== 'queued') await syncNotificationEmail(log);
}

async function finishLog(logId, update) {
  const log = await EmailLog.findByIdAndUpdate(logId, update, { new: true }).lean();
  if (log?.notificationId) {
    await syncNotificationEmail(log).catch((e) => logger.warn(`Email status sync failed for ${logId}: ${e.message}`));
  }
  return log;
}

/** logId → promise of { status, error } for emails still being sent (see waitForEmail). */
const inFlight = new Map();

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.templateKey
 * @param {Record<string, unknown>} opts.vars
 * @param {import('mongoose').Types.ObjectId} [opts.campaignId]
 * @param {import('mongoose').Types.ObjectId} [opts.notificationId]  member notification this email delivers
 * @param {number} [opts.maxAttempts]
 */
export async function queueEmail({ to, templateKey, vars, campaignId, notificationId, maxAttempts = 3 }) {
  // Read before any await so the caller's tracking context is the one we report to.
  const tracking = emailTracking.getStore();
  // Desk-registered members may not have an email address.
  if (!to) return null;
  const { subject, html } = renderTemplate(templateKey, vars);
  const log = await EmailLog.create({ to, templateKey, campaignId, notificationId, status: 'queued', subject });
  tracking?.onQueued?.(log);

  const done = queue.add(async () => {
    let lastErr = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await EmailLog.findByIdAndUpdate(log._id, { attempts: attempt });
        await deliverEmail({ to, subject, html });
        await finishLog(log._id, { status: 'sent', sentAt: new Date(), lastError: '' });
        return { status: 'sent', error: '' };
      } catch (e) {
        lastErr = e.message;
        logger.warn(`Email attempt ${attempt} failed for ${to}: ${lastErr}`);
        await EmailLog.findByIdAndUpdate(log._id, { lastError: lastErr });
        if (e.permanent) break;
        if (attempt < maxAttempts) await sleep(500 * 2 ** (attempt - 1));
      }
    }
    await finishLog(log._id, { status: 'failed', lastError: lastErr });
    return { status: 'failed', error: lastErr };
  });
  const tracked = done.catch((e) => ({ status: 'failed', error: e?.message || String(e) })).finally(() => inFlight.delete(String(log._id)));
  inFlight.set(String(log._id), tracked);
  return log;
}

/**
 * Waits (up to `timeoutMs`) for a queued email's outcome, for screens where staff are told
 * whether it went: { status: 'sent' | 'failed' | 'queued', error }.
 */
export async function waitForEmail(logId, timeoutMs = 25_000) {
  if (!logId) return { status: 'failed', error: 'No email was queued' };
  const pending = inFlight.get(String(logId));
  if (pending) {
    const result = await Promise.race([pending, sleep(timeoutMs).then(() => null)]);
    if (result) return result;
  }
  const log = await EmailLog.findById(logId).select('status lastError').lean();
  return { status: log?.status || 'failed', error: log?.lastError || '' };
}

/**
 * Emails still "queued" long after they were created were lost when the server stopped (the
 * queue lives in memory). Marks them failed so every screen tells the truth. Run at start-up.
 */
export async function failAbandonedEmails(olderThanMs = 30 * 60_000) {
  const stale = await EmailLog.find({ status: 'queued', createdAt: { $lt: new Date(Date.now() - olderThanMs) } })
    .select('_id')
    .limit(1000)
    .lean();
  for (const { _id } of stale) {
    await finishLog(_id, { status: 'failed', lastError: 'Not sent: the server restarted before this email went out.' });
  }
  return stale.length;
}

/** Send immediately (still logged). Throws the explained error if it fails. */
export async function sendEmailNow({ to, templateKey, vars, campaignId }) {
  const { subject, html } = renderTemplate(templateKey, vars);
  const log = await EmailLog.create({ to, templateKey, campaignId, status: 'queued', subject });
  try {
    await deliverEmail({ to, subject, html });
    await EmailLog.findByIdAndUpdate(log._id, { status: 'sent', sentAt: new Date(), attempts: 1 });
  } catch (e) {
    await EmailLog.findByIdAndUpdate(log._id, { status: 'failed', attempts: 1, lastError: e.message });
    throw e;
  }
  return log;
}

/** One line in the server log at start-up: how email will be sent (never the key or password). */
export function reportEmailSetup() {
  const s = emailStatus();
  if (!s.configured) {
    logger.warn(`Email is NOT configured (${s.provider}): add ${s.missing.join(' and ')}. No email will be sent.`);
    return;
  }
  logger.info(`Email: ${s.provider === 'brevo' ? 'Brevo HTTPS API' : 'SMTP'} via ${s.server}, from ${s.from}`);
}
