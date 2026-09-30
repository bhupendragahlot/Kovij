import EmailCampaign from '../models/EmailCampaign.js';
import EmailLog from '../models/EmailLog.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const withEmail = { email: { $type: 'string' }, isActive: { $ne: false } };

/** Audience definitions. "expired" means had a plan before and has nothing current now. */
export async function resolveRecipients(audienceFilter) {
  const current = () => Membership.distinct('memberId', { status: { $in: ['active', 'upcoming', 'pending'] } });
  if (audienceFilter === 'all') {
    return Member.find(withEmail).select('email name').lean();
  }
  if (audienceFilter === 'activeMembers') {
    const active = await Membership.distinct('memberId', { status: 'active' });
    return Member.find({ ...withEmail, _id: { $in: active } }).select('email name').lean();
  }
  if (audienceFilter === 'expired') {
    const [everJoined, covered] = await Promise.all([Membership.distinct('memberId'), current()]);
    const coveredSet = new Set(covered.map(String));
    const lapsed = everJoined.filter((id) => !coveredSet.has(String(id)));
    return Member.find({ ...withEmail, _id: { $in: lapsed } }).select('email name').lean();
  }
  if (audienceFilter === 'noMembership') {
    const anyMem = await Membership.distinct('memberId');
    return Member.find({ ...withEmail, _id: { $nin: anyMem } }).select('email name').lean();
  }
  return [];
}

const templateKeyForType = (type) => (['offer', 'festival', 'info'].includes(type) ? type : 'bulk');

/** POST /api/campaigns */
export const createCampaign = asyncHandler(async (req, res) => {
  const b = req.validated.body;
  const doc = await EmailCampaign.create({
    title: b.title,
    type: b.type,
    subject: b.subject,
    bodyHtml: b.bodyHtml,
    audienceFilter: b.audienceFilter,
    scheduledAt: b.scheduledAt,
    status: 'draft',
    createdBy: req.staffUser.email || req.staffUser.id,
  });
  res.status(201).json({ success: true, campaign: doc });
});

/** GET /api/campaigns — delivery stats come from the email log, not optimistic counters. */
export const listCampaigns = asyncHandler(async (req, res) => {
  const list = await EmailCampaign.find().sort({ createdAt: -1 }).limit(100).lean();
  const stats = await EmailLog.aggregate([
    { $match: { campaignId: { $in: list.map((c) => c._id) } } },
    { $group: { _id: { c: '$campaignId', s: '$status' }, n: { $sum: 1 } } },
  ]);
  const byCampaign = {};
  for (const row of stats) {
    const key = String(row._id.c);
    byCampaign[key] = byCampaign[key] || { queued: 0, sent: 0, failed: 0 };
    byCampaign[key][row._id.s] = row.n;
  }
  res.json({
    success: true,
    campaigns: list.map((c) => ({ ...c, stats: byCampaign[String(c._id)] || { queued: 0, sent: 0, failed: 0 } })),
  });
});

/** GET /api/campaigns/audience/:filter — recipient count preview before sending. */
export const previewAudience = asyncHandler(async (req, res) => {
  const recipients = await resolveRecipients(req.params.filter);
  res.json({ success: true, count: recipients.length });
});

/** POST /api/campaigns/:id/send */
export const sendCampaign = asyncHandler(async (req, res) => {
  const camp = await EmailCampaign.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ['draft', 'failed'] } },
    { $set: { status: 'sending' } },
    { new: true }
  );
  if (!camp) throw new AppError('This campaign was already sent', 409, 'ALREADY_SENT');

  const [recipients, settings] = await Promise.all([resolveRecipients(camp.audienceFilter), getSettingsDoc()]);
  const templateKey = templateKeyForType(camp.type);

  for (const r of recipients) {
    queueEmail({
      to: r.email,
      templateKey,
      vars: { subject: camp.subject, bodyHtml: camp.bodyHtml, name: r.name, gymName: settings.gymName },
      campaignId: camp._id,
    }).catch(() => {});
  }

  // "sent" = handed to the delivery queue; per-recipient results live in EmailLog.
  await EmailCampaign.findByIdAndUpdate(camp._id, { status: 'sent', 'stats.queued': recipients.length });
  res.json({ success: true, queued: recipients.length });
});

/** POST /api/campaigns/:id/test */
export const testCampaign = asyncHandler(async (req, res) => {
  const camp = await EmailCampaign.findById(req.params.id);
  if (!camp) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
  const settings = await getSettingsDoc();
  await queueEmail({
    to: req.validated.body.to,
    templateKey: templateKeyForType(camp.type),
    vars: { subject: `[Test] ${camp.subject}`, bodyHtml: camp.bodyHtml, name: req.staffUser.name || 'Test', gymName: settings.gymName },
    campaignId: camp._id,
  });
  res.json({ success: true, message: 'Test email queued' });
});
