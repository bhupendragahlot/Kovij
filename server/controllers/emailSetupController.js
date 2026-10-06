import EmailLog from '../models/EmailLog.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emailStatus, queueEmail, waitForEmail } from '../services/emailService.js';

/**
 * Settings → Email (owner): how the server sends email, how the last week went, and a test send
 * that reports exactly what happened. Never returns a key or password.
 */

/** GET /api/admin/settings/email */
export const emailSetup = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [counts, lastFailure] = await Promise.all([
    EmailLog.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    EmailLog.findOne({ status: 'failed', createdAt: { $gte: since } }).sort({ createdAt: -1 }).select('lastError templateKey createdAt').lean(),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  res.json({
    success: true,
    email: emailStatus(),
    lastWeek: { sent: by.sent || 0, failed: by.failed || 0, queued: by.queued || 0 },
    lastFailure: lastFailure ? { at: lastFailure.createdAt, error: lastFailure.lastError, templateKey: lastFailure.templateKey } : null,
    defaultTo: req.staffUser.email || '',
  });
});

/** POST /api/admin/settings/email/test — sends one email now and waits for the result. */
export const sendTestEmail = asyncHandler(async (req, res) => {
  const to = req.validated.body.to || req.staffUser.email;
  if (!to) throw new AppError('Your login has no email address. Type one to send the test to.', 422, 'VALIDATION_ERROR', { fields: { to: 'Enter an email address' } });
  const settings = await getSettingsDoc();
  const setup = emailStatus();
  const log = await queueEmail({ to, templateKey: 'emailTest', vars: { provider: setup.provider, server: setup.server, gymName: settings.gymName }, maxAttempts: 1 });
  const outcome = await waitForEmail(log._id, 30_000);
  res.json({ success: true, ok: outcome.status === 'sent', status: outcome.status, error: outcome.error, to, email: setup });
});
