import path from 'path';
import fs from 'fs';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import MemberProfile from '../models/MemberProfile.js';
import PlanHistory from '../models/PlanHistory.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { getSettingsDoc } from '../models/Settings.js';
import { can } from '../config/permissions.js';
import { queueEmail, waitForEmail } from '../services/emailService.js';
import {
  exportMembersCsv,
  findPossibleDuplicates,
  getMemberDetail,
  joinedAtFromDay,
  listMembersWithStanding,
  redactMemberDetail,
  resolveReferral,
  upsertProfile,
} from '../services/memberService.js';
import { buildTimeline, cancelMembershipRecord } from '../services/membershipService.js';
import { registerDeskMember, sellMembership } from '../services/salesService.js';
import { findByIdempotencyKey } from '../services/paymentService.js';
import { privateUploadPath, removeAvatar } from '../services/storageService.js';
import { withTransaction } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { gymDayKey } from '../utils/time.js';
import { AppError } from '../middleware/errorHandler.js';

const staffActor = (req) => ({ id: req.staffUser.id, role: req.staffUser.role });
/** What the signed-in role may see beyond basic member details. */
const visibility = (req) => ({
  money: can(req.staffUser.role, 'payments.view'),
  health: can(req.staffUser.role, 'members.health.view'),
});

/** Only roles with price.override may sell below list price. */
function assertCanOverridePrice(req, sale) {
  if (sale?.priceOverride != null && !can(req.staffUser.role, 'price.override')) {
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
  const query = req.validated.query;
  const { money } = visibility(req);
  if (query.state === 'dues' && !money) throw new AppError('Your role can’t see dues', 403, 'FORBIDDEN');
  const settings = await getSettingsDoc();
  const result = await listMembersWithStanding({ ...query, expiringWindowDays: settings.expiringWindowDays });
  if (!money) {
    result.members = result.members.map(({ dues, ...m }) => m);
    delete result.counts.dues;
  }
  res.json({ success: true, ...result });
});

/** GET /api/admin/members/export.csv — the filtered list as a spreadsheet (no health data). */
export const exportMembers = asyncHandler(async (req, res) => {
  const query = req.validated.query;
  const { money } = visibility(req);
  if (query.state === 'dues' && !money) throw new AppError('Your role can’t see dues', 403, 'FORBIDDEN');
  const settings = await getSettingsDoc();
  const { csv, count } = await exportMembersCsv({ ...query, expiringWindowDays: settings.expiringWindowDays, includeMoney: money });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="members-${gymDayKey()}.csv"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Row-Count', String(count));
  res.send(csv);
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
  res.json({ success: true, ...redactMemberDetail(detail, visibility(req)) });
});

/** GET /api/admin/members/:id/timeline — joins, renewals, freezes, extensions, cancellations. */
export const getTimeline = asyncHandler(async (req, res) => {
  const memberId = req.params.id;
  if (!(await Member.exists({ _id: memberId }))) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const [history, memberships] = await Promise.all([
    PlanHistory.find({ memberId }).sort({ changedAt: -1 }).limit(300).lean(),
    Membership.find({ memberId }).select('planName price status startDate endDate source createdBy').lean(),
  ]);
  const userIds = [...new Set([...history.map((h) => h.createdBy), ...memberships.map((m) => m.createdBy)].filter(Boolean).map(String))];
  const planIds = [...new Set(history.flatMap((h) => [h.toPlanId, h.fromPlanId]).filter(Boolean).map(String))];
  const [users, plans] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name username').lean(),
    Plan.find({ _id: { $in: planIds } }).select('name').lean(),
  ]);
  const items = buildTimeline({
    history,
    memberships,
    users: new Map(users.map((u) => [String(u._id), u.name || u.username])),
    planNames: new Map(plans.map((p) => [String(p._id), p.name])),
    includeMoney: visibility(req).money,
  });
  res.json({ success: true, items });
});

/** POST /api/admin/members — desk registration, optionally with a first plan and payment. */
export const createMember = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  if (body.membership && !can(req.staffUser.role, 'memberships.sell')) {
    throw new AppError('Your role can’t sell plans. Register the member without a plan.', 403, 'FORBIDDEN');
  }
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
    const { address, emergencyContact, joinedAt, referral, ...rest } = details;
    Object.assign(member, rest);
    // Set nested fields one by one so a partial address doesn't wipe the rest of it.
    for (const [k, v] of Object.entries(address || {})) member.set(`address.${k}`, v);
    for (const [k, v] of Object.entries(emergencyContact || {})) member.set(`emergencyContact.${k}`, v);
    if (joinedAt !== undefined) member.joinedAt = joinedAtFromDay(joinedAt);
    if (referral === null) member.referral = undefined;
    else if (referral !== undefined) member.referral = (await resolveReferral(referral, { selfId: member._id })) || undefined;
    await member.save();
  }
  await upsertProfile(member._id, health);
  const profile = visibility(req).health ? await MemberProfile.findOne({ memberId: member._id }).lean() : null;
  res.json({ success: true, member: member.toObject(), profile });
});

/** POST /api/admin/members/:id/photo — multipart `photo` (camera or file); replaces the old one. */
export const uploadPhoto = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id).select('profilePhoto');
  if (!member) {
    await removeAvatar(req.avatarUrl);
    throw new AppError('Member not found', 404, 'NOT_FOUND');
  }
  const previous = member.profilePhoto;
  member.profilePhoto = req.avatarUrl;
  await member.save();
  if (previous && previous !== req.avatarUrl) await removeAvatar(previous);
  res.json({ success: true, member: { _id: member._id, profilePhoto: member.profilePhoto } });
});

/** DELETE /api/admin/members/:id/photo */
export const removePhoto = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id).select('profilePhoto');
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const previous = member.profilePhoto;
  member.profilePhoto = '';
  await member.save();
  await removeAvatar(previous);
  res.json({ success: true, member: { _id: member._id, profilePhoto: '' } });
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
      changeType: sale.changeType === 'renew' ? 'renewed' : sale.changeType === 'upgrade' ? 'upgraded' : sale.changeType === 'downgrade' ? 'changed' : sale.changeType,
      gymName: settings.gymName,
    },
  }).catch(() => {});

  res.status(201).json({ success: true, sale: saleResponse(sale) });
});

/** POST /api/admin/members/:id/memberships/:membershipId/cancel */
export const cancelMembership = asyncHandler(async (req, res) => {
  const membership = await withTransaction((session) =>
    cancelMembershipRecord(
      { membershipId: req.params.membershipId, memberId: req.params.id, staff: staffActor(req), reason: req.validated.body?.reason },
      session
    )
  );
  res.json({ success: true, membership });
});

/** POST /api/admin/members/:id/notify */
export const notifyMember = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (!member.email) throw new AppError('This member has no email address', 422, 'NO_EMAIL');
  const settings = await getSettingsDoc();
  const { subject, bodyHtml } = req.validated.body;
  const log = await queueEmail({ to: member.email, templateKey: 'info', vars: { subject, bodyHtml, name: member.name, gymName: settings.gymName } });
  // Wait for the send so staff hear whether it really went.
  const outcome = await waitForEmail(log?._id);
  if (outcome.status === 'failed') throw new AppError(`The email couldn't be sent: ${outcome.error}`, 422, 'EMAIL_NOT_SENT');
  res.json({ success: true, message: outcome.status === 'sent' ? `Email sent to ${member.email}` : `Email is on its way to ${member.email}` });
});

/** GET /api/admin/members/:id/id-proof — ID documents are never served publicly. */
export const getIdProof = asyncHandler(async (req, res) => {
  const profile = await MemberProfile.findOne({ memberId: req.params.id }).lean();
  const filePath = privateUploadPath(profile?.idProof?.url);
  if (!filePath || !fs.existsSync(filePath)) throw new AppError('No ID proof on file', 404, 'NOT_FOUND');
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(path.resolve(filePath));
});
