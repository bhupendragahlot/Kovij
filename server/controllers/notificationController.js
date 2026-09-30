import {
  getPreferences,
  listNotificationLog,
  markAllRead,
  markRead,
  memberCommunication,
  memberInbox,
  sendMemberMessage,
  unreadCount,
  updatePreferences,
} from '../services/notificationService.js';
import { countDevices, isPushConfigured, pushConfig, removeSubscription, saveSubscription } from '../services/pushChannel.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ── Staff (/api/admin/notifications) ─────────────────────────────────────────

/** GET / — everything sent to members, with channel status and failure reasons. */
export const log = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listNotificationLog(req.validated.query)) });
});

/** GET /members/:memberId — what can reach this member, and their recent messages. */
export const forMember = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberCommunication(req.validated.params.memberId)) });
});

/** POST /messages — send one member a message (Idempotency-Key required). */
export const sendMessage = asyncHandler(async (req, res) => {
  const result = await sendMemberMessage(req.validated.body, req.staffUser, req.idempotencyKey);
  res.status(201).json({ success: true, ...result });
});

// ── Member app (/api/member/notifications) ───────────────────────────────────

/** GET / — the member's inbox, newest first. */
export const inbox = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await memberInbox(req.member.memberId, req.validated.query)) });
});

/** GET /unread-count */
export const unread = asyncHandler(async (req, res) => {
  res.json({ success: true, unread: await unreadCount(req.member.memberId) });
});

/** POST /:id/read */
export const readOne = asyncHandler(async (req, res) => {
  const notification = await markRead(req.member.memberId, req.params.id);
  res.json({ success: true, notification, unread: await unreadCount(req.member.memberId) });
});

/** POST /read-all */
export const readAll = asyncHandler(async (req, res) => {
  res.json({ success: true, updated: await markAllRead(req.member.memberId), unread: 0 });
});

const LOCKED_NOTE = 'Plan and payment reminders always appear in your inbox so you never miss a renewal.';

/** GET /preferences */
export const preferences = asyncHandler(async (req, res) => {
  res.json({ success: true, preferences: await getPreferences(req.member.memberId), alwaysOn: ['plan_reminders', 'payment_reminders'], note: LOCKED_NOTE });
});

/** PATCH /preferences */
export const savePreferences = asyncHandler(async (req, res) => {
  res.json({ success: true, preferences: await updatePreferences(req.member.memberId, req.validated.body), alwaysOn: ['plan_reminders', 'payment_reminders'], note: LOCKED_NOTE });
});

/** GET /push/key — the VAPID public key the browser needs to subscribe. */
export const pushKey = asyncHandler(async (req, res) => {
  const configured = isPushConfigured();
  res.json({ success: true, configured, publicKey: configured ? pushConfig().publicKey : '' });
});

/** POST /push/subscribe */
export const pushSubscribe = asyncHandler(async (req, res) => {
  await saveSubscription(req.member.memberId, req.validated.body.subscription, req.get('User-Agent'));
  res.status(201).json({ success: true, subscribed: true, configured: isPushConfigured(), devices: await countDevices(req.member.memberId) });
});

/** POST /push/unsubscribe */
export const pushUnsubscribe = asyncHandler(async (req, res) => {
  const removed = await removeSubscription(req.member.memberId, req.validated.body.endpoint);
  res.json({ success: true, removed: removed > 0, devices: await countDevices(req.member.memberId) });
});
