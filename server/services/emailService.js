import { AsyncLocalStorage } from 'node:async_hooks';
import nodemailer from 'nodemailer';
import PQueue from 'p-queue';
import EmailLog from '../models/EmailLog.js';
import Notification from '../models/Notification.js';
import { renderTemplate } from './emailTemplates/index.js';
import { logger } from '../utils/logger.js';

let transporter = null;
const queue = new PQueue({ concurrency: 3 });

/**
 * Lets a caller learn which EmailLog a nested queueEmail() created, without threading ids
 * through code it doesn't own (e.g. notifyMember). services/memberNotifier.js uses it to link
 * each member notification to its email, so the notification's email status becomes the real
 * outcome (sent / failed and why) instead of staying "queued".
 */
export const emailTracking = new AsyncLocalStorage();

export const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
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
}

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
  const log = await EmailLog.create({
    to,
    templateKey,
    campaignId,
    notificationId,
    status: 'queued',
    subject,
  });
  tracking?.onQueued?.(log);

  queue.add(async () => {
    let attempt = 0;
    let lastErr = '';
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        await EmailLog.findByIdAndUpdate(log._id, { attempts: attempt });
        const t = getTransporter();
        if (!isEmailConfigured()) {
          throw new Error('EMAIL_USER / EMAIL_PASS not configured');
        }
        await t.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject,
          html,
        });
        await finishLog(log._id, {
          status: 'sent',
          sentAt: new Date(),
          lastError: '',
        });
        return;
      } catch (e) {
        lastErr = e?.message || String(e);
        logger.warn(`Email attempt ${attempt} failed for ${to}: ${lastErr}`);
        await EmailLog.findByIdAndUpdate(log._id, { lastError: lastErr });
        if (attempt < maxAttempts) {
          await sleep(500 * 2 ** (attempt - 1));
        }
      }
    }
    await finishLog(log._id, { status: 'failed', lastError: lastErr });
  });

  return log;
}

/**
 * Send immediately (still logged) — used when queue not needed for single critical path tests
 */
export async function sendEmailNow({ to, templateKey, vars, campaignId }) {
  const { subject, html } = renderTemplate(templateKey, vars);
  const log = await EmailLog.create({
    to,
    templateKey,
    campaignId,
    status: 'queued',
    subject,
  });
  try {
    const t = getTransporter();
    await t.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
    await EmailLog.findByIdAndUpdate(log._id, { status: 'sent', sentAt: new Date(), attempts: 1 });
  } catch (e) {
    await EmailLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      attempts: 1,
      lastError: e?.message || String(e),
    });
    throw e;
  }
  return log;
}
