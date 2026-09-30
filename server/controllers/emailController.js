import Lead from '../models/Lead.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { endOfGymDay } from '../utils/time.js';

/**
 * POST /api/send-email — public website contact form.
 * Every enquiry becomes a lead the desk can follow up; the owner gets a notification and the
 * visitor a short acknowledgement. All visitor input is escaped by the email templates.
 */
export const sendEmail = asyncHandler(async (req, res) => {
  const { name, email, phone, message } = req.validated.body;
  const settings = await getSettingsDoc();

  await Lead.create({
    name,
    email,
    phone,
    source: 'website',
    status: 'new',
    message,
    nextFollowUpAt: endOfGymDay(),
  });

  const ownerInbox = settings.email || process.env.EMAIL_USER;
  await Promise.all([
    queueEmail({ to: ownerInbox, templateKey: 'contactNotification', vars: { name, email, phone, message } }),
    queueEmail({ to: email, templateKey: 'contactAutoReply', vars: { name, gymName: settings.gymName } }),
  ]);

  res.status(200).json({ success: true, message: 'Thanks. We will get back to you soon.' });
});
