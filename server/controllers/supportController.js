import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createTicket,
  getMemberTicket,
  getStaffTicket,
  listMemberTickets,
  listStaffTickets,
  memberReply,
  memberResolve,
  staffReply,
  updateStaffTicket,
} from '../services/supportService.js';

// ── Member app: /api/member/support ─────────────────────────────────────────

export const myTickets = asyncHandler(async (req, res) => {
  res.json({ success: true, items: await listMemberTickets(req.member.memberId) });
});

export const openTicket = asyncHandler(async (req, res) => {
  const ticket = await createTicket({ memberId: req.member.memberId, ...req.validated.body });
  res.status(201).json({ success: true, ticket, message: 'Sent. The gym will reply here, and we’ll let you know.' });
});

export const myTicket = asyncHandler(async (req, res) => {
  res.json({ success: true, ticket: await getMemberTicket(req.member.memberId, req.params.id) });
});

export const replyToMine = asyncHandler(async (req, res) => {
  res.json({ success: true, ticket: await memberReply(req.member.memberId, req.params.id, req.validated.body.text) });
});

export const resolveMine = asyncHandler(async (req, res) => {
  res.json({ success: true, ticket: await memberResolve(req.member.memberId, req.params.id) });
});

// ── Staff inbox: /api/admin/support ─────────────────────────────────────────

export const inbox = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listStaffTickets({ ...req.validated.query, staffId: req.staffUser.id })) });
});

export const inboxTicket = asyncHandler(async (req, res) => {
  res.json({ success: true, ticket: await getStaffTicket(req.params.id) });
});

export const replyFromDesk = asyncHandler(async (req, res) => {
  const ticket = await staffReply(req.params.id, req.validated.body, req.staffUser);
  // Top-level `member` lets the activity log name who was answered.
  res.json({ success: true, ticket, member: ticket.member ? { _id: ticket.member.id } : undefined });
});

export const updateFromDesk = asyncHandler(async (req, res) => {
  const ticket = await updateStaffTicket(req.params.id, req.validated.body);
  res.json({ success: true, ticket, member: ticket.member ? { _id: ticket.member.id } : undefined });
});
