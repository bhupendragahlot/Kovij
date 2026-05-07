import EmailCampaign from '../models/EmailCampaign.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

async function resolveRecipients(audienceFilter) {
  if (audienceFilter === 'all') {
    return Member.find({ isActive: true }).select('email name').lean();
  }
  if (audienceFilter === 'activeMembers') {
    const active = await Membership.distinct('memberId', { status: 'active' });
    return Member.find({ _id: { $in: active } }).select('email name').lean();
  }
  if (audienceFilter === 'expired') {
    const activeIds = await Membership.distinct('memberId', { status: 'active' });
    return Member.find({ _id: { $nin: activeIds } }).select('email name').lean();
  }
  if (audienceFilter === 'noMembership') {
    const anyMem = await Membership.distinct('memberId');
    return Member.find({ _id: { $nin: anyMem } }).select('email name').lean();
  }
  return [];
}

function templateKeyForType(type) {
  if (type === 'offer') return 'offer';
  if (type === 'festival') return 'festival';
  if (type === 'info') return 'info';
  return 'bulk';
}

export const createCampaign = asyncHandler(async (req, res) => {
  const b = req.validated?.body || req.body;
  const createdBy = req.staffUser?.email || req.staffUser?.id || '';
  const doc = await EmailCampaign.create({
    title: b.title,
    type: b.type,
    subject: b.subject,
    bodyHtml: b.bodyHtml,
    audienceFilter: b.audienceFilter,
    scheduledAt: b.scheduledAt,
    status: 'draft',
    createdBy,
  });
  res.status(201).json({ success: true, campaign: doc });
});

export const listCampaigns = asyncHandler(async (req, res) => {
  const list = await EmailCampaign.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ success: true, campaigns: list });
});

export const sendCampaign = asyncHandler(async (req, res) => {
  const camp = await EmailCampaign.findById(req.params.id);
  if (!camp) throw new AppError('Campaign not found', 404, 'NOT_FOUND');

  const updated = await EmailCampaign.findOneAndUpdate(
    { _id: camp._id, status: { $in: ['draft', 'queued', 'failed'] } },
    { $set: { status: 'sending' } },
    { new: true }
  );
  if (!updated) throw new AppError('Campaign already sending or sent', 409, 'CONFLICT');

  const recipients = await resolveRecipients(camp.audienceFilter);
  const templateKey = templateKeyForType(camp.type);

  await EmailCampaign.findByIdAndUpdate(camp._id, {
    'stats.queued': recipients.length,
    'stats.sent': 0,
    'stats.failed': 0,
  });

  for (const r of recipients) {
    if (!r.email) continue;
    queueEmail({
      to: r.email,
      templateKey,
      vars: { subject: camp.subject, bodyHtml: camp.bodyHtml, name: r.name },
      campaignId: camp._id,
    }).catch(() => {});
  }

  await EmailCampaign.findByIdAndUpdate(camp._id, {
    status: 'sent',
    'stats.sent': recipients.length,
  });

  res.json({ success: true, queued: recipients.length });
});

export const testCampaign = asyncHandler(async (req, res) => {
  const camp = await EmailCampaign.findById(req.params.id);
  if (!camp) throw new AppError('Campaign not found', 404, 'NOT_FOUND');
  const to = req.validated?.body?.to || req.body.to;
  const templateKey = templateKeyForType(camp.type);
  await queueEmail({
    to,
    templateKey,
    vars: { subject: `[TEST] ${camp.subject}`, bodyHtml: camp.bodyHtml, name: 'Test' },
    campaignId: camp._id,
  });
  res.json({ success: true, message: 'Test email queued' });
});
