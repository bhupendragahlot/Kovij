import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import MemberProfile from '../models/MemberProfile.js';
import { queueEmail } from '../services/emailService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

export const listMembers = asyncHandler(async (req, res) => {
  const q = req.query.q || '';
  const filter = q
    ? {
        $or: [
          { name: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') },
          { phone: new RegExp(q, 'i') },
        ],
      }
    : {};
  const members = await Member.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, members });
});

export const getMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id).lean();
  if (!member) throw new AppError('Not found', 404, 'NOT_FOUND');
  const profile = await MemberProfile.findOne({ memberId: member._id }).lean();
  const membership = await Membership.findOne({ memberId: member._id, status: 'active' })
    .populate('planId')
    .lean();
  res.json({ success: true, member, profile, membership });
});

export const forceExpire = asyncHandler(async (req, res) => {
  const m = await Membership.findOne({ memberId: req.params.id, status: 'active' });
  if (!m) throw new AppError('No active membership', 400, 'NO_ACTIVE');
  m.status = 'expired';
  m.endDate = new Date();
  await m.save();
  res.json({ success: true });
});

export const notifyMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw new AppError('Not found', 404, 'NOT_FOUND');
  const { subject, bodyHtml } = req.body;
  if (!subject || !bodyHtml) throw new AppError('subject and bodyHtml required', 400, 'BAD_REQUEST');
  queueEmail({
    to: member.email,
    templateKey: 'info',
    vars: { subject, bodyHtml, name: member.name },
  }).catch(() => {});
  res.json({ success: true, message: 'Email queued' });
});
