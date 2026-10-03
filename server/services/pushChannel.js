/**
 * Web push delivery channel. Importing this module registers the 'push' channel with
 * services/notify.js, so every notifyMember() call also reaches the member's subscribed
 * browsers/phones. Imported at startup by routes/member/notificationRoutes.js and cron/cronRunner.js.
 *
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (generate with `node server/scripts/generate-vapid-keys.js`)
 * and VAPID_SUBJECT (mailto: or https: contact for the push services). Without keys every push
 * is reported as skipped with reason `push_not_configured`; nothing else changes.
 */
import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import { registerChannel } from './notify.js';
import { logger } from '../utils/logger.js';

const TTL_SECONDS = 24 * 60 * 60;
const SEND_TIMEOUT_MS = 10_000;
/** Newest devices kept per member. */
export const MAX_DEVICES = 10;

/**
 * Only the browser vendors' push services. The server POSTs to the stored endpoint, so an
 * arbitrary URL here would let a member make the server call any address (SSRF).
 */
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isAllowedPushEndpoint(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.port && !url.username && PUSH_HOSTS.some((rx) => rx.test(url.hostname));
}

export function pushConfig() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const fallbackSubject = process.env.EMAIL_USER ? `mailto:${process.env.EMAIL_USER}` : process.env.APP_URL || 'https://kovij.onrender.com';
  const subject = (process.env.VAPID_SUBJECT || '').trim() || fallbackSubject;
  return { publicKey, privateKey, subject };
}

export const isPushConfigured = () => {
  const { publicKey, privateKey } = pushConfig();
  return Boolean(publicKey && privateKey);
};

let appliedFor = '';
/** Apply keys lazily (and again if the environment changes); throws on malformed keys. */
function applyVapid() {
  const { publicKey, privateKey, subject } = pushConfig();
  const signature = `${publicKey}|${privateKey}|${subject}`;
  if (signature === appliedFor) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  appliedFor = signature;
}

/** What the service worker (public/push-handler.js) receives. Same-origin paths only. */
export function buildPushPayload(notification) {
  const link = typeof notification.link === 'string' && notification.link.startsWith('/') && !notification.link.startsWith('//') ? notification.link : '/member/dashboard';
  return JSON.stringify({
    title: String(notification.title || '').slice(0, 120),
    body: String(notification.body || '').slice(0, 240),
    url: link,
    tag: notification.kind,
    notificationId: String(notification._id || ''),
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png', // monochrome K: Android draws badges from transparency only
    timestamp: new Date(notification.createdAt || Date.now()).getTime(),
  });
}

/**
 * Channel handler for notifyMember. Never throws for per-member problems: returns
 * { status: 'sent'|'skipped'|'failed', reason }.
 */
export async function sendPushToMember({ notification, member }) {
  if (notification?.meta?.push === false) return { status: 'skipped', reason: 'not_requested' };
  if (!isPushConfigured()) return { status: 'skipped', reason: 'push_not_configured' };
  const subs = await PushSubscription.find({ memberId: member._id }).sort({ updatedAt: -1 }).limit(MAX_DEVICES).lean();
  if (!subs.length) return { status: 'skipped', reason: 'no_subscription' };
  try {
    applyVapid();
  } catch (e) {
    logger.error(`Web push keys are invalid: ${e.message}`);
    return { status: 'failed', reason: 'push_keys_invalid' };
  }

  const payload = buildPushPayload(notification);
  let sent = 0;
  let gone = 0;
  let lastError = '';
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: TTL_SECONDS, urgency: 'normal', timeout: SEND_TIMEOUT_MS });
        sent += 1;
        await PushSubscription.updateOne({ _id: s._id }, { $set: { lastSuccessAt: new Date(), failCount: 0 } });
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          // The browser unsubscribed or the app was uninstalled: forget the device.
          gone += 1;
          await PushSubscription.deleteOne({ _id: s._id });
        } else {
          lastError = e?.statusCode ? `push_service_${e.statusCode}` : String(e?.message || 'push_failed').slice(0, 120);
          await PushSubscription.updateOne({ _id: s._id }, { $inc: { failCount: 1 } });
        }
      }
    })
  );

  if (sent) return { status: 'sent', reason: sent < subs.length ? `${sent} of ${subs.length} devices` : '' };
  if (gone === subs.length) return { status: 'skipped', reason: 'no_subscription' };
  return { status: 'failed', reason: lastError || 'push_failed' };
}

registerChannel('push', sendPushToMember);

/** Save (or move to this member) a browser subscription, keeping the newest MAX_DEVICES. */
export async function saveSubscription(memberId, { endpoint, keys, expirationTime }, userAgent = '') {
  const set = {
    memberId,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    userAgent: String(userAgent || '').slice(0, 300),
    failCount: 0,
  };
  if (expirationTime) set.expirationTime = new Date(expirationTime);
  const update = { $set: set };
  let doc;
  try {
    doc = await PushSubscription.findOneAndUpdate({ endpoint }, update, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  } catch (e) {
    // Two upserts of the same endpoint raced; the second one simply updates.
    if (e?.code !== 11000) throw e;
    doc = await PushSubscription.findOneAndUpdate({ endpoint }, update, { new: true }).lean();
  }
  const extra = await PushSubscription.find({ memberId }).sort({ updatedAt: -1 }).skip(MAX_DEVICES).select('_id').lean();
  if (extra.length) await PushSubscription.deleteMany({ _id: { $in: extra.map((x) => x._id) } });
  return doc;
}

export async function removeSubscription(memberId, endpoint) {
  const { deletedCount } = await PushSubscription.deleteOne({ memberId, endpoint });
  return deletedCount;
}

export async function countDevices(memberId) {
  return PushSubscription.countDocuments({ memberId });
}
