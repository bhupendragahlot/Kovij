/**
 * OWNER: member app content & support module. Member questions and the desk's replies.
 *
 * Members open a request from the app; the desk answers from the Support inbox. A reply from the
 * gym notifies the member (in-app + email). Resolved requests can be reopened by a member reply
 * for RESOLVED_REOPEN_DAYS, then close for good. Pure rules are unit-tested.
 */
import SupportTicket from '../models/SupportTicket.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import { nextSequence } from '../models/Counter.js';
import { notifyMember } from './notify.js';
import { currentMembershipState } from './membershipService.js';
import { gymContact } from './memberNotifier.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { escapeRegex } from '../utils/strings.js';
import './emailTemplates/supportEmails.js';

export const RESOLVED_REOPEN_DAYS = 7;
export const MAX_OPEN_PER_MEMBER = 5;
const DAY_MS = 86_400_000;
const ACTIVE = ['open', 'waiting_member'];

/** Resolved long enough ago that it should now count as closed. */
export function isExpiredResolution(ticket, now = new Date()) {
  return ticket.status === 'resolved' && ticket.resolvedAt && now - new Date(ticket.resolvedAt) > RESOLVED_REOPEN_DAYS * DAY_MS;
}

/**
 * Status after a new message.
 *   member writes → open (reopens a resolved request)
 *   staff writes  → waiting_member, unless staff chose a status (e.g. resolved) with the reply
 */
export function statusAfterReply(current, by, requested) {
  if (current === 'closed') throw new AppError('This request is closed. Start a new one if you still need help.', 409, 'TICKET_CLOSED');
  if (by === 'member') return 'open';
  return requested || 'waiting_member';
}

/** What each side sees. Members never see who on the staff is assigned or internal flags. */
export function ticketView(t, audience) {
  const base = {
    id: String(t._id),
    number: t.number,
    reference: `#${String(t.number).padStart(4, '0')}`,
    category: t.category,
    subject: t.subject,
    status: t.status,
    lastMessageAt: t.lastMessageAt,
    lastMessageBy: t.lastMessageBy,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt || null,
  };
  const messages = (t.messages || []).map((m) => ({
    id: String(m._id),
    by: m.by,
    // Members see "Kovij team" plus the first name, never staff surnames or ids.
    author: m.by === 'member' ? 'You' : m.staffName ? m.staffName.split(' ')[0] : 'Gym team',
    text: m.text,
    at: m.at,
  }));
  if (audience === 'member') {
    return { ...base, unread: Boolean(t.unreadForMember), canReply: t.status !== 'closed', messages };
  }
  return {
    ...base,
    unread: Boolean(t.unreadForStaff),
    assignedTo: t.assignedTo ? { id: String(t.assignedTo._id || t.assignedTo), name: t.assignedTo.name || '' } : null,
    member: t.memberId?._id ? { id: String(t.memberId._id), name: t.memberId.name, phone: t.memberId.phone || '', memberCode: t.memberId.memberCode || '', photo: t.memberId.profilePhoto || '' } : null,
    messages: messages.map((m, i) => ({ ...m, author: m.by === 'member' ? t.memberId?.name || 'Member' : t.messages[i].staffName || 'Staff' })),
    preview: (t.messages?.at(-1)?.text || '').slice(0, 140),
  };
}

/** Close resolved requests whose reopen window has passed (lazy; no scheduled job needed). */
export async function closeStaleResolutions(now = new Date()) {
  await SupportTicket.updateMany(
    { status: 'resolved', resolvedAt: { $lt: new Date(now - RESOLVED_REOPEN_DAYS * DAY_MS) } },
    { $set: { status: 'closed', closedAt: now } }
  );
}

// ── Member side ──────────────────────────────────────────────────────────────

export async function createTicket({ memberId, category, subject, message }) {
  const open = await SupportTicket.countDocuments({ memberId, status: { $in: ACTIVE } });
  if (open >= MAX_OPEN_PER_MEMBER) {
    throw new AppError(`You already have ${open} open requests. Reply on one of those, and the gym will get back to you.`, 409, 'TOO_MANY_OPEN');
  }
  const now = new Date();
  const ticket = await SupportTicket.create({
    number: await nextSequence('supportTicket'),
    memberId,
    category,
    subject,
    status: 'open',
    messages: [{ by: 'member', text: message, at: now }],
    lastMessageAt: now,
    lastMessageBy: 'member',
    unreadForStaff: true,
    unreadForMember: false,
  });
  return ticketView(ticket, 'member');
}

export async function listMemberTickets(memberId, now = new Date()) {
  await closeStaleResolutions(now);
  const tickets = await SupportTicket.find({ memberId }).sort({ lastMessageAt: -1 }).limit(100).lean();
  return tickets.map((t) => {
    const { messages, ...rest } = ticketView(t, 'member');
    return { ...rest, preview: (messages.at(-1)?.text || '').slice(0, 140), lastAuthor: messages.at(-1)?.author || '' };
  });
}

async function ownTicket(memberId, id) {
  const ticket = await SupportTicket.findOne({ _id: id, memberId });
  if (!ticket) throw new AppError('Request not found', 404, 'NOT_FOUND');
  return ticket;
}

export async function getMemberTicket(memberId, id, now = new Date()) {
  const ticket = await ownTicket(memberId, id);
  if (isExpiredResolution(ticket, now)) Object.assign(ticket, { status: 'closed', closedAt: now });
  if (ticket.unreadForMember || ticket.isModified()) {
    ticket.unreadForMember = false;
    await ticket.save();
  }
  return ticketView(ticket, 'member');
}

export async function memberReply(memberId, id, text, now = new Date()) {
  const ticket = await ownTicket(memberId, id);
  if (isExpiredResolution(ticket, now)) {
    ticket.set({ status: 'closed', closedAt: now });
    await ticket.save();
  }
  ticket.status = statusAfterReply(ticket.status, 'member');
  ticket.messages.push({ by: 'member', text, at: now });
  ticket.set({ lastMessageAt: now, lastMessageBy: 'member', unreadForStaff: true, unreadForMember: false, resolvedAt: undefined });
  await ticket.save();
  return ticketView(ticket, 'member');
}

export async function memberResolve(memberId, id, now = new Date()) {
  const ticket = await ownTicket(memberId, id);
  if (ticket.status === 'closed') return ticketView(ticket, 'member');
  ticket.set({ status: 'resolved', resolvedAt: now, unreadForStaff: true });
  await ticket.save();
  return ticketView(ticket, 'member');
}

// ── Staff side ───────────────────────────────────────────────────────────────

const STAFF_POPULATE = [
  { path: 'memberId', select: 'name phone memberCode profilePhoto' },
  { path: 'assignedTo', select: 'name username' },
];

export async function listStaffTickets({ status = 'active', q, assigned, staffId, page = 1, limit = 25, now = new Date() }) {
  await closeStaleResolutions(now);
  const filter = {};
  if (status === 'active') filter.status = { $in: ACTIVE };
  else if (status !== 'all') filter.status = status;
  if (assigned === 'me') filter.assignedTo = staffId;
  if (assigned === 'none') filter.assignedTo = { $exists: false };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const memberIds = await Member.find({ $or: [{ name: rx }, { phone: rx }, { memberCode: rx }] }).distinct('_id');
    const asNumber = Number(String(q).replace(/^#/, ''));
    filter.$or = [{ subject: rx }, { memberId: { $in: memberIds } }, ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ number: asNumber }] : [])];
  }
  const [rows, total, counts, unread] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ unreadForStaff: -1, lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-messages.staffId')
      .populate(STAFF_POPULATE)
      .lean(),
    SupportTicket.countDocuments(filter),
    SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SupportTicket.countDocuments({ status: { $in: ACTIVE }, unreadForStaff: true }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  return {
    items: rows.map((t) => {
      const { messages, ...rest } = ticketView(t, 'staff');
      return { ...rest, messageCount: messages.length };
    }),
    total,
    page,
    limit,
    counts: { active: (byStatus.open || 0) + (byStatus.waiting_member || 0), open: byStatus.open || 0, waiting_member: byStatus.waiting_member || 0, resolved: byStatus.resolved || 0, closed: byStatus.closed || 0, unread },
  };
}

async function staffTicket(id) {
  const ticket = await SupportTicket.findById(id).populate(STAFF_POPULATE);
  if (!ticket) throw new AppError('Request not found', 404, 'NOT_FOUND');
  return ticket;
}

async function withMemberStanding(view) {
  if (!view.member) return view;
  const { state, membership } = await currentMembershipState(view.member.id);
  return { ...view, member: { ...view.member, state, planName: membership?.planName || '', planEnds: membership?.endDate || null } };
}

export async function getStaffTicket(id, now = new Date()) {
  const ticket = await staffTicket(id);
  if (isExpiredResolution(ticket, now)) ticket.set({ status: 'closed', closedAt: now });
  if (ticket.unreadForStaff || ticket.isModified()) {
    ticket.unreadForStaff = false;
    await ticket.save();
  }
  return withMemberStanding(ticketView(ticket, 'staff'));
}

/** A reply from the desk, optionally changing the status in the same step; the member is told. */
export async function staffReply(id, { text, status }, staff, now = new Date()) {
  const ticket = await staffTicket(id);
  ticket.status = statusAfterReply(ticket.status, 'staff', status);
  ticket.messages.push({ by: 'staff', staffId: staff.id, staffName: staff.name, text, at: now });
  ticket.set({ lastMessageAt: now, lastMessageBy: 'staff', unreadForStaff: false, unreadForMember: true });
  if (ticket.status === 'resolved') ticket.resolvedAt = now;
  if (!ticket.assignedTo) ticket.assignedTo = staff.id;
  await ticket.save();

  const settings = await getSettingsDoc();
  await notifyMember({
    memberId: ticket.memberId._id || ticket.memberId,
    kind: 'support',
    title: `Reply about “${ticket.subject}”`,
    body: text.slice(0, 200),
    link: `/member/support/${ticket._id}`,
    email: {
      templateKey: 'supportReply',
      vars: {
        subject: ticket.subject,
        reply: text,
        staffName: staff.name.split(' ')[0],
        reference: `#${String(ticket.number).padStart(4, '0')}`,
        ticketId: String(ticket._id),
        gymName: settings.gymName,
        contact: gymContact(settings),
      },
    },
    dedupeKey: `support:${ticket._id}:${ticket.messages.at(-1)._id}`,
    createdBy: staff.id,
  });
  await ticket.populate(STAFF_POPULATE);
  return withMemberStanding(ticketView(ticket, 'staff'));
}

/** Change status, category or who's handling it. */
export async function updateStaffTicket(id, { status, assignedTo, category }, now = new Date()) {
  const ticket = await staffTicket(id);
  if (assignedTo !== undefined) {
    if (assignedTo && !(await User.exists({ _id: assignedTo, isActive: { $ne: false } }))) {
      throw new AppError('That staff account isn’t active', 422, 'VALIDATION_ERROR', { fields: { assignedTo: 'Choose an active staff member' } });
    }
    ticket.assignedTo = assignedTo || undefined;
  }
  if (category) ticket.category = category;
  if (status && status !== ticket.status) {
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = now;
    if (status === 'closed') ticket.closedAt = now;
    if (status === 'open' || status === 'waiting_member') ticket.set({ resolvedAt: undefined, closedAt: undefined });
  }
  await ticket.save();
  await ticket.populate(STAFF_POPULATE);
  return withMemberStanding(ticketView(ticket, 'staff'));
}

/** Unread member messages, for the desk's "Needs attention" list. */
export const unreadSupportCount = () => SupportTicket.countDocuments({ status: { $in: ACTIVE }, unreadForStaff: true });
