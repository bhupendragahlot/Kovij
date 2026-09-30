/**
 * Reading and managing notifications: the member's in-app inbox and preferences, the staff
 * log of everything sent, and one-off staff messages to a member.
 * Sending always goes through notifyMember (via memberNotifier.sendToMember).
 */
import Member from '../models/Member.js';
import Notification from '../models/Notification.js';
import { getSettingsDoc } from '../models/Settings.js';
import { gymContact, sendToMember } from './memberNotifier.js';
import { countDevices, isPushConfigured } from './pushChannel.js';
import { REMINDER_KINDS } from './reminderRules.js';
import { AppError } from '../middleware/errorHandler.js';
import { toObjectId } from '../utils/db.js';
import { parseGymDay } from '../utils/time.js';

export const PREFERENCE_KEYS = ['email', 'push', 'announcements', 'birthday', 'workoutUpdates'];

/** Log filter groups shown to staff. `other` = kinds from other modules (workouts, receipts…). */
export const KIND_GROUPS = {
  reminders: REMINDER_KINDS,
  announcements: ['announcement'],
  messages: ['message'],
};
const KNOWN_KINDS = Object.values(KIND_GROUPS).flat();

// ── Member inbox ─────────────────────────────────────────────────────────────

const INBOX_FIELDS = 'kind title body link readAt createdAt';

export async function memberInbox(memberId, { page = 1, limit = 20, unread = false }) {
  const owner = { memberId: toObjectId(memberId) };
  const filter = unread ? { ...owner, readAt: null } : owner;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select(INBOX_FIELDS).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...owner, readAt: null }),
  ]);
  return { items, total, page, limit, unread: unreadCount };
}

export const unreadCount = (memberId) => Notification.countDocuments({ memberId: toObjectId(memberId), readAt: null });

/** Mark one of the member's own notifications read (keeps the first read time). */
export async function markRead(memberId, id) {
  const n = await Notification.findOneAndUpdate(
    { _id: id, memberId: toObjectId(memberId) },
    [{ $set: { readAt: { $ifNull: ['$readAt', '$$NOW'] } } }],
    { new: true, projection: INBOX_FIELDS }
  ).lean();
  if (!n) throw new AppError('Notification not found', 404, 'NOT_FOUND');
  return n;
}

export async function markAllRead(memberId) {
  const { modifiedCount } = await Notification.updateMany({ memberId: toObjectId(memberId), readAt: null }, { $set: { readAt: new Date() } });
  return modifiedCount;
}

// ── Member preferences ───────────────────────────────────────────────────────

function withDefaults(prefs = {}) {
  return Object.fromEntries(PREFERENCE_KEYS.map((k) => [k, prefs?.[k] !== false]));
}

export async function getPreferences(memberId) {
  const member = await Member.findById(memberId).select('notificationPrefs').lean();
  if (!member) throw new AppError('Your member account was not found. Sign in again.', 404, 'NOT_FOUND');
  return withDefaults(member.notificationPrefs);
}

export async function updatePreferences(memberId, patch) {
  const set = {};
  for (const key of PREFERENCE_KEYS) if (typeof patch[key] === 'boolean') set[`notificationPrefs.${key}`] = patch[key];
  const member = await Member.findByIdAndUpdate(memberId, { $set: set }, { new: true, runValidators: true }).select('notificationPrefs').lean();
  if (!member) throw new AppError('Your member account was not found. Sign in again.', 404, 'NOT_FOUND');
  return withDefaults(member.notificationPrefs);
}

// ── Staff log ────────────────────────────────────────────────────────────────

function shapeLogItem(n) {
  const member = n.memberId && typeof n.memberId === 'object' ? n.memberId : null;
  return {
    _id: n._id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    link: n.link,
    createdAt: n.createdAt,
    readAt: n.readAt || null,
    channels: n.channels || {},
    member: member ? { _id: member._id, name: member.name, memberCode: member.memberCode || '' } : null,
    sentBy: n.createdBy && typeof n.createdBy === 'object' ? n.createdBy.name || null : null,
    meta: n.meta ? { stage: n.meta.stage, days: n.meta.days, amount: n.meta.amount, reminderNo: n.meta.reminderNo, template: n.meta.template } : {},
  };
}

/**
 * Everything sent to members, newest first.
 * @param {{ group?: 'reminders'|'announcements'|'messages'|'other', kind?: string, memberId?: string,
 *           from?: string, to?: string, problems?: boolean, page: number, limit: number }} q
 */
export async function listNotificationLog({ group, kind, memberId, from, to, problems, page = 1, limit = 25 }) {
  const filter = {};
  if (kind) filter.kind = kind;
  else if (group === 'other') filter.kind = { $nin: KNOWN_KINDS };
  else if (group && KIND_GROUPS[group]) filter.kind = { $in: KIND_GROUPS[group] };
  if (memberId) filter.memberId = toObjectId(memberId);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = parseGymDay(from).toDate();
    if (to) filter.createdAt.$lte = parseGymDay(to).endOf('day').toDate();
  }
  if (problems) filter.$or = [{ 'channels.email.status': 'failed' }, { 'channels.push.status': 'failed' }];

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('memberId', 'name memberCode')
      .populate('createdBy', 'name')
      .lean(),
    Notification.countDocuments(filter),
  ]);
  return { items: items.map(shapeLogItem), total, page, limit };
}

// ── Staff → member messages ──────────────────────────────────────────────────

/** What the Message dialog needs: which channels can reach this member, and recent messages. */
export async function memberCommunication(memberId) {
  const member = await Member.findById(memberId).select('name email notificationPrefs isActive').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const prefs = withDefaults(member.notificationPrefs);
  const [devices, recent] = await Promise.all([
    countDevices(member._id),
    Notification.find({ memberId: member._id }).sort({ createdAt: -1 }).limit(8).populate('createdBy', 'name').lean(),
  ]);
  return {
    member: { _id: member._id, name: member.name, isActive: member.isActive !== false },
    email: { available: Boolean(member.email), optedOut: !prefs.email },
    push: { configured: isPushConfigured(), devices, optedOut: !prefs.push },
    recent: recent.map(shapeLogItem),
  };
}

/**
 * One message from staff to a member: always in the app, plus email and/or push when chosen.
 * `idempotencyKey` (from the request) doubles as a database-level duplicate guard.
 */
export async function sendMemberMessage({ memberId, title, body, email = true, push = true, template = 'custom' }, staff, idempotencyKey) {
  const member = await Member.findById(memberId).select('_id isActive').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (member.isActive === false) throw new AppError('This member is deactivated. Reactivate them before sending a message.', 409, 'MEMBER_INACTIVE');
  const settings = await getSettingsDoc();
  const { notification, created } = await sendToMember({
    memberId: member._id,
    kind: 'message',
    title,
    body,
    link: '/member/notifications',
    email: email ? { templateKey: 'memberMessage', vars: { subject: title, body, gymName: settings.gymName, contact: gymContact(settings) } } : false,
    preference: null,
    dedupeKey: idempotencyKey ? `message:${staff.id}:${idempotencyKey}` : undefined,
    meta: { template, push, ...(email && { emailTemplate: 'memberMessage' }) },
    createdBy: staff.id,
  });
  if (!notification) throw new AppError('Member not found', 404, 'NOT_FOUND');
  return { notification: shapeLogItem({ ...notification, createdBy: { name: staff.name } }), created };
}
