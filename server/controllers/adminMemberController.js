import path from 'path';
import fs from 'fs';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import MemberProfile from '../models/MemberProfile.js';
import { getSettingsDoc } from '../models/Settings.js';
import { queueEmail } from '../services/emailService.js';
import { findPossibleDuplicates, getMemberDetail, listMembersWithStanding, upsertProfile } from '../services/memberService.js';
import { registerDeskMember, sellMembership } from '../services/salesService.js';
import { findByIdempotencyKey } from '../services/paymentService.js';
import { privateUploadPath } from '../services/storageService.js';
import { withTransaction } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const staffActor = (req) => ({ id: req.staffUser.id, role: req.staffUser.role });

/** Only managers may sell below list price. */
function assertCanOverridePrice(req, sale) {
  if (sale?.priceOverride != null && !['admin', 'manager'].includes(req.staffUser.role)) {
    throw new AppError('Only a manager can change the plan price', 403, 'FORBIDDEN');
  }
}

function saleResponse(sale) {
  if (!sale) return null;
  return {
    membership: sale.membership,
    payments: sale.payments,
    planName: sale.plan.name,
    changeType: sale.changeType,
  };
}

/** GET /api/admin/members */
export const listMembers = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  const result = await listMembersWithStanding({ ...req.validated.query, expiringWindowDays: settings.expiringWindowDays });
  res.json({ success: true, ...result });
});

/** GET /api/admin/members/duplicates?phone=&email= — live duplicate hint while typing. */
export const checkDuplicates = asyncHandler(async (req, res) => {
  const matches = await findPossibleDuplicates(req.validated.query);
  res.json({ success: true, matches });
});

/** GET /api/admin/members/:id */
export const getMember = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  const detail = await getMemberDetail(req.params.id, { expiringWindowDays: settings.expiringWindowDays });
  if (!detail) throw new AppError('Member not found', 404, 'NOT_FOUND');
  res.json({ success: true, ...detail });
});

/** POST /api/admin/members — desk registration, optionally with a first plan and payment. */
export const createMember = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  assertCanOverridePrice(req, body.membership);
  const settings = await getSettingsDoc();

  const result = await withTransaction((session) =>
    registerDeskMember(
      { ...body, staff: staffActor(req), settings, idempotencyKey: req.idempotencyKey },
      session
    )
  );

  if (result.sale?.membership.status === 'active') {
    queueEmail({
      to: result.member.email,
      templateKey: 'welcome',
      vars: {
        name: result.member.name,
        planName: result.sale.plan.name,
        startDate: result.sale.membership.startDate,
        endDate: result.sale.membership.endDate,
        gymName: settings.gymName,
      },
    }).catch(() => {});
  }

  res.status(201).json({ success: true, member: result.member, sale: saleResponse(result.sale) });
});

/** PATCH /api/admin/members/:id */
export const updateMember = asyncHandler(async (req, res) => {
  const { details, health } = req.validated.body;
  const member = await Member.findById(req.params.id);
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');

  if (details) {
    const { address, emergencyContact, ...rest } = details;
    Object.assign(member, rest);
    // Set nested fields one by one so a partial address doesn't wipe the rest of it.
    for (const [k, v] of Object.entries(address || {})) member.set(`address.${k}`, v);
    for (const [k, v] of Object.entries(emergencyContact || {})) member.set(`emergencyContact.${k}`, v);
    await member.save();
  }
  await upsertProfile(member._id, health);
  const profile = await MemberProfile.findOne({ memberId: member._id }).lean();
  res.json({ success: true, member: member.toObject(), profile });
});

/** POST /api/admin/members/:id/memberships — renew, switch plan, or first plan. */
export const sellPlan = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  assertCanOverridePrice(req, body);
  const member = await Member.findById(req.params.id).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');

  // Backstop for idempotency: if the payment for this key already exists, the sale happened.
  const existing = await findByIdempotencyKey(req.idempotencyKey && `${req.idempotencyKey}:plan`);
  if (existing) {
    const membership = await Membership.findById(existing.membershipId).lean();
    return res.json({ success: true, replayed: true, sale: { membership, payments: [existing] } });
  }

  const settings = await getSettingsDoc();
  const sale = await withTransaction((session) =>
    sellMembership(
      { memberId: member._id, ...body, staff: staffActor(req), settings, idempotencyKey: req.idempotencyKey },
      session
    )
  );

  queueEmail({
    to: member.email,
    templateKey: sale.changeType === 'join' ? 'welcome' : 'planUpdated',
    vars: {
      name: member.name,
      planName: sale.plan.name,
      startDate: sale.membership.startDate,
      endDate: sale.membership.endDate,
      changeType: sale.changeType === 'renew' ? 'renewed' : sale.changeType,
      gymName: settings.gymName,
    },
  }).catch(() => {});

  res.status(201).json({ success: true, sale: saleResponse(sale) });
});

/** POST /api/admin/members/:id/memberships/:membershipId/cancel */
export const cancelMembership = asyncHandler(async (req, res) => {
  const m = await Membership.findOne({ _id: req.params.membershipId, memberId: req.params.id });
  if (!m) throw new AppError('Membership not found', 404, 'NOT_FOUND');
  if (!['active', 'upcoming', 'pending'].includes(m.status)) {
    throw new AppError('Only a current or upcoming plan can be cancelled', 409, 'NOT_CANCELLABLE');
  }
  m.status = 'cancelled';
  if (m.endDate > new Date()) m.endDate = new Date();
  await m.save();
  res.json({ success: true, membership: m });
});

/** POST /api/admin/members/:id/notify */
export const notifyMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (!member.email) throw new AppError('This member has no email address', 422, 'NO_EMAIL');
  const settings = await getSettingsDoc();
  const { subject, bodyHtml } = req.validated.body;
  await queueEmail({ to: member.email, templateKey: 'info', vars: { subject, bodyHtml, name: member.name, gymName: settings.gymName } });
  res.json({ success: true, message: 'Email queued' });
});

/** GET /api/admin/members/:id/id-proof — ID documents are never served publicly. */
export const getIdProof = asyncHandler(async (req, res) => {
  const profile = await MemberProfile.findOne({ memberId: req.params.id }).lean();
  const filePath = privateUploadPath(profile?.idProof?.url);
  if (!filePath || !fs.existsSync(filePath)) throw new AppError('No ID proof on file', 404, 'NOT_FOUND');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(path.resolve(filePath));
});
