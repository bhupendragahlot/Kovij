import nodemailer from 'nodemailer';
import PQueue from 'p-queue';
import EmailLog from '../models/EmailLog.js';
import { renderTemplate } from './emailTemplates/index.js';
import { logger } from '../utils/logger.js';

let transporter = null;
const queue = new PQueue({ concurrency: 3 });

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

/**
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.templateKey
 * @param {Record<string, unknown>} opts.vars
 * @param {import('mongoose').Types.ObjectId} [opts.campaignId]
 * @param {number} [opts.maxAttempts]
 */
export async function queueEmail({ to, templateKey, vars, campaignId, maxAttempts = 3 }) {
  const { subject, html } = renderTemplate(templateKey, vars);
  const log = await EmailLog.create({
    to,
    templateKey,
    campaignId,
    status: 'queued',
    subject,
  });

  queue.add(async () => {
    let attempt = 0;
    let lastErr = '';
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        await EmailLog.findByIdAndUpdate(log._id, { attempts: attempt });
        const t = getTransporter();
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          throw new Error('EMAIL_USER / EMAIL_PASS not configured');
        }
        await t.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject,
          html,
        });
        await EmailLog.findByIdAndUpdate(log._id, {
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
    await EmailLog.findByIdAndUpdate(log._id, { status: 'failed', lastError: lastErr });
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
