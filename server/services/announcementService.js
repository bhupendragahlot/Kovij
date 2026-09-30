/**
 * Announcements: gym-wide notices members see in the app, plus a one-time delivery to each
 * member in the audience (in-app notification, push, and email when chosen).
 *
 * Delivery runs in the background in batches, never inside the publish request. It holds a
 * short lease on the announcement so two processes can't deliver at once, and every send has
 * dedupeKey `announcement:<id>:<memberId>`, so a crash, restart or re-publish resumes instead of
 * repeating. cron/announcementCron.js publishes scheduled ones and resumes interrupted deliveries.
 */
import PQueue from 'p-queue';
import Announcement from '../models/Announcement.js';
import Member from '../models/Member.js';
import Membership from '../models/Membership.js';
import Notification from '../models/Notification.js';
import { getSettingsDoc } from '../models/Settings.js';
import { appLink, gymContact, sendToMember } from './memberNotifier.js';
import { AppError } from '../middleware/errorHandler.js';
import { toObjectId } from '../utils/db.js';
import { logger } from '../utils/logger.js';

const BATCH_SIZE = 50;
const LEASE_MS = 2 * 60 * 1000;
/** A publish time within this window counts as "now". */
const NOW_TOLERANCE_MS = 60 * 1000;
export const ANNOUNCEMENT_LINK = '/member/announcements';

const CURRENT = ['active', 'upcoming', 'paused'];
const NOT_LAPSED = ['active', 'upcoming', 'pending', 'paused'];

/** Member ids in an audience (deactivated members excluded). */
export async function resolveAudienceIds(audience) {
  const base = { isActive: { $ne: false } };
  if (audience === 'active') {
    const ids = await Membership.distinct('memberId', { status: { $in: CURRENT } });
    return (await Member.find({ ...base, _id: { $in: ids } }).select('_id').lean()).map((m) => m._id);
  }
  if (audience === 'lapsed') {
    const [ever, current] = await Promise.all([Membership.distinct('memberId'), Membership.distinct('memberId', { status: { $in: NOT_LAPSED } })]);
    const covered = new Set(current.map(String));
    const lapsed = ever.filter((id) => !covered.has(String(id)));
    return (await Member.find({ ...base, _id: { $in: lapsed } }).select('_id').lean()).map((m) => m._id);
  }
  return (await Member.find(base).select('_id').lean()).map((m) => m._id);
}

/** Which audiences a member belongs to (for their announcement feed). */
export async function memberAudiences(memberId) {
  const statuses = await Membership.distinct('status', { memberId: toObjectId(memberId) });
  const audiences = ['all'];
  if (statuses.some((s) => CURRENT.includes(s))) audiences.push('active');
  else if (statuses.length && !statuses.some((s) => NOT_LAPSED.includes(s))) audiences.push('lapsed');
  return audiences;
}

export async function audienceSize(audience) {
  const ids = await resolveAudienceIds(audience);
  if (!ids.length) return { count: 0, reachable: 0 };
  const optedOut = await Member.countDocuments({ _id: { $in: ids }, 'notificationPrefs.announcements': false });
  return { count: ids.length, reachable: ids.length - optedOut };
}

/** Status as members and staff experience it. */
export function displayState(a, now = new Date()) {
  if (a.status === 'published') {
    if (a.expiresAt && new Date(a.expiresAt) <= now) return 'ended';
    return 'live';
  }
  return a.status;
}

const LIST_FILTERS = {
  live: (now) => ({ status: 'published', $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }),
  ended: (now) => ({ status: 'published', expiresAt: { $lte: now } }),
  scheduled: () => ({ status: 'scheduled' }),
  draft: () => ({ status: 'draft' }),
  unpublished: () => ({ status: 'unpublished' }),
  all: () => ({}),
};

/** Delivery results per announcement, counted from the notifications themselves. */
async function deliveryStats(ids) {
  if (!ids.length) return new Map();
  const rows = await Notification.aggregate([
    { $match: { kind: 'announcement', 'meta.announcementId': { $in: ids } } },
    {
      $group: {
        _id: '$meta.announcementId',
        notified: { $sum: 1 },
        read: { $sum: { $cond: [{ $ifNull: ['$readAt', false] }, 1, 0] } },
        emailSent: { $sum: { $cond: [{ $in: ['$channels.email.status', ['sent', 'queued']] }, 1, 0] } },
        emailFailed: { $sum: { $cond: [{ $eq: ['$channels.email.status', 'failed'] }, 1, 0] } },
        pushSent: { $sum: { $cond: [{ $eq: ['$channels.push.status', 'sent'] }, 1, 0] } },
        pushFailed: { $sum: { $cond: [{ $eq: ['$channels.push.status', 'failed'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map(({ _id, ...r }) => [String(_id), r]));
}

const EMPTY_STATS = { notified: 0, read: 0, emailSent: 0, emailFailed: 0, pushSent: 0, pushFailed: 0 };

function shape(a, stats, now) {
  return { ...a, state: displayState(a, now), stats: stats?.get(String(a._id)) || { ...EMPTY_STATS } };
}

export async function listAnnouncements({ status = 'all', page = 1, limit = 25 }, now = new Date()) {
  const filter = (LIST_FILTERS[status] || LIST_FILTERS.all)(now);
  const [items, total, counts] = await Promise.all([
    Announcement.find(filter)
      .sort({ pinned: -1, publishAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name')
      .populate('publishedBy', 'name')
      .lean(),
    Announcement.countDocuments(filter),
    Promise.all(Object.entries(LIST_FILTERS).map(async ([key, f]) => [key, await Announcement.countDocuments(f(now))])),
  ]);
  const stats = await deliveryStats(items.map((a) => a._id));
  return { items: items.map((a) => shape(a, stats, now)), total, page, limit, counts: Object.fromEntries(counts) };
}

export async function getAnnouncement(id, now = new Date()) {
  const a = await Announcement.findById(id).populate('createdBy', 'name').populate('publishedBy', 'name').lean();
  if (!a) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  return shape(a, await deliveryStats([a._id]), now);
}

function checkDates({ publishAt, expiresAt }, now) {
  if (expiresAt && new Date(expiresAt) <= now) {
    throw new AppError('The end date has already passed. Pick a later end date or leave it empty.', 422, 'VALIDATION_ERROR', {
      fields: { expiresAt: 'Pick a date in the future' },
    });
  }
  if (expiresAt && publishAt && new Date(expiresAt) <= new Date(publishAt)) {
    throw new AppError('The end date must be after the publish time.', 422, 'VALIDATION_ERROR', { fields: { expiresAt: 'Must be after the publish time' } });
  }
}

export async function createAnnouncement(data, staff, now = new Date()) {
  checkDates(data, now);
  const a = await Announcement.create({ ...data, status: 'draft', createdBy: staff.id, updatedBy: staff.id });
  return getAnnouncement(a._id, now);
}

/** Once delivery has started, who it goes to and whether it is emailed can no longer change. */
const LOCKED_AFTER_DELIVERY = ['audience', 'sendEmail'];

export async function updateAnnouncement(id, patch, staff, now = new Date()) {
  const a = await Announcement.findById(id).lean();
  if (!a) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  const delivered = a.delivery?.state && a.delivery.state !== 'none';
  for (const field of LOCKED_AFTER_DELIVERY) {
    if (delivered && patch[field] !== undefined && patch[field] !== a[field]) {
      throw new AppError('This announcement was already sent, so its audience and email choice can’t change. Create a new one instead.', 409, 'ALREADY_SENT');
    }
  }
  if (a.status === 'published' && patch.publishAt !== undefined && String(patch.publishAt) !== String(a.publishAt)) {
    throw new AppError('This announcement is already live. Unpublish it first to change when it goes out.', 409, 'ALREADY_LIVE');
  }
  const next = { ...a, ...patch };
  if (patch.expiresAt !== undefined || patch.publishAt !== undefined) checkDates(next, now);

  const set = {};
  const unset = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) unset[k] = 1;
    else if (v !== undefined) set[k] = v;
  }
  set.updatedBy = staff.id;
  // Guard against a concurrent publish: only update the version we validated.
  const updated = await Announcement.findOneAndUpdate({ _id: id, status: a.status, updatedAt: a.updatedAt }, { $set: set, ...(Object.keys(unset).length && { $unset: unset }) });
  if (!updated) throw new AppError('Someone else just changed this announcement. Reload and try again.', 409, 'CONFLICT');
  // A scheduled announcement with its time changed to "now" goes out right away.
  if (a.status === 'scheduled' && (!next.publishAt || new Date(next.publishAt) <= new Date(now.getTime() + NOW_TOLERANCE_MS))) {
    return publishAnnouncement(id, staff, now);
  }
  return getAnnouncement(id, now);
}

/**
 * Publish now (or schedule, when publishAt is in the future). Idempotent: publishing a live
 * announcement returns it unchanged, and delivery happens at most once per member.
 */
export async function publishAnnouncement(id, staff, now = new Date()) {
  const a = await Announcement.findById(id).lean();
  if (!a) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  if (a.status === 'published') return getAnnouncement(id, now);
  checkDates(a, now);

  const future = a.publishAt && new Date(a.publishAt).getTime() > now.getTime() + NOW_TOLERANCE_MS;
  const set = future
    ? { status: 'scheduled', updatedBy: staff?.id }
    : {
        status: 'published',
        publishAt: a.publishAt && new Date(a.publishAt) <= now ? a.publishAt : now,
        publishedAt: now,
        publishedBy: staff?.id,
        updatedBy: staff?.id,
      };
  // Start delivery only the first time (or resume one that unpublishing stopped).
  if (!future && ['none', 'stopped'].includes(a.delivery?.state || 'none')) set['delivery.state'] = 'pending';

  const updated = await Announcement.findOneAndUpdate({ _id: id, status: a.status }, { $set: set }, { new: true }).lean();
  if (!updated) throw new AppError('Someone else just changed this announcement. Reload and try again.', 409, 'CONFLICT');
  if (updated.status === 'published' && updated.delivery?.state === 'pending') startDelivery(updated._id);
  return getAnnouncement(id, now);
}

/** Take it down (live → unpublished) or cancel a schedule (scheduled → draft). Sent notifications stay in inboxes. */
export async function unpublishAnnouncement(id, staff, now = new Date()) {
  const a = await Announcement.findById(id).lean();
  if (!a) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  if (a.status === 'draft' || a.status === 'unpublished') return getAnnouncement(id, now);
  const set = a.status === 'scheduled' ? { status: 'draft' } : { status: 'unpublished', unpublishedAt: now };
  set.updatedBy = staff.id;
  const updated = await Announcement.findOneAndUpdate({ _id: id, status: a.status }, { $set: set });
  if (!updated) throw new AppError('Someone else just changed this announcement. Reload and try again.', 409, 'CONFLICT');
  return getAnnouncement(id, now);
}

export async function deleteAnnouncement(id) {
  const a = await Announcement.findById(id).lean();
  if (!a) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  if (a.status !== 'draft' || (a.delivery?.state && a.delivery.state !== 'none')) {
    throw new AppError('Only drafts that were never sent can be deleted. Unpublish this one instead.', 409, 'NOT_DELETABLE');
  }
  await Announcement.deleteOne({ _id: id, status: 'draft' });
}

/** Kick off delivery without blocking the caller. */
export function startDelivery(id) {
  setImmediate(() => {
    deliverAnnouncement(id).catch((e) => logger.error(`Announcement ${id} delivery failed: ${e.message}`));
  });
}

async function takeLease(id) {
  const now = new Date();
  return Announcement.findOneAndUpdate(
    {
      _id: id,
      status: 'published',
      'delivery.state': { $in: ['pending', 'running'] },
      $or: [{ 'delivery.leaseUntil': null }, { 'delivery.leaseUntil': { $lt: now } }],
    },
    { $set: { 'delivery.state': 'running', 'delivery.leaseUntil': new Date(now.getTime() + LEASE_MS), 'delivery.error': '' } },
    { new: true }
  ).lean();
}

/**
 * Deliver one announcement to its audience. Returns quietly if another worker holds it or it
 * is no longer live. Safe to call repeatedly.
 */
export async function deliverAnnouncement(id) {
  const a = await takeLease(id);
  if (!a) return null;
  if (!a.delivery.startedAt) await Announcement.updateOne({ _id: id }, { $set: { 'delivery.startedAt': new Date() } });

  try {
    const [ids, settings] = await Promise.all([resolveAudienceIds(a.audience), getSettingsDoc()]);
    await Announcement.updateOne({ _id: id }, { $set: { 'delivery.audienceCount': ids.length } });
    const vars = {
      gymName: settings.gymName,
      contact: gymContact(settings),
      title: a.title,
      body: a.body,
      category: a.category,
      imageUrl: a.imageUrl,
      ctaUrl: appLink('/member/dashboard'),
    };
    const counters = { processed: 0, notified: 0, skipped: 0, failed: 0 };
    const queue = new PQueue({ concurrency: 5 });

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      // Stop if staff unpublished it meanwhile; publishing again resumes from here.
      const current = await Announcement.findById(id).select('status').lean();
      if (current?.status !== 'published') {
        await Announcement.updateOne({ _id: id }, { $set: { 'delivery.state': 'stopped', 'delivery.leaseUntil': null } });
        return { stopped: true, ...counters };
      }
      const batch = ids.slice(i, i + BATCH_SIZE);
      const members = await Member.find({ _id: { $in: batch }, isActive: { $ne: false } }).select('notificationPrefs').lean();
      const wanted = new Set(members.filter((m) => m.notificationPrefs?.announcements !== false).map((m) => String(m._id)));
      counters.skipped += batch.length - wanted.size;

      await Promise.all(
        [...wanted].map((memberId) =>
          queue.add(async () => {
            try {
              const { created } = await sendToMember({
                memberId,
                kind: 'announcement',
                title: a.title,
                body: a.body,
                link: ANNOUNCEMENT_LINK,
                email: a.sendEmail ? { templateKey: 'announcement', vars } : false,
                preference: 'announcements',
                dedupeKey: `announcement:${a._id}:${memberId}`,
                meta: { announcementId: a._id, category: a.category, ...(a.sendEmail && { emailTemplate: 'announcement' }) },
                createdBy: a.publishedBy,
              });
              counters[created ? 'notified' : 'skipped'] += 1;
            } catch (e) {
              counters.failed += 1;
              logger.warn(`Announcement ${a._id} to ${memberId} failed: ${e.message}`);
            }
          })
        )
      );
      counters.processed = Math.min(ids.length, i + batch.length);
      await Announcement.updateOne(
        { _id: id },
        { $set: { 'delivery.processed': counters.processed, 'delivery.notified': counters.notified, 'delivery.skipped': counters.skipped, 'delivery.failed': counters.failed, 'delivery.leaseUntil': new Date(Date.now() + LEASE_MS) } }
      );
    }

    await Announcement.updateOne({ _id: id }, { $set: { 'delivery.state': 'done', 'delivery.finishedAt': new Date(), 'delivery.leaseUntil': null } });
    logger.info(`Announcement ${id} delivered: ${counters.notified} notified, ${counters.skipped} skipped, ${counters.failed} failed`);
    return counters;
  } catch (e) {
    // Leave it resumable: the cron job picks up 'running' deliveries whose lease has lapsed.
    await Announcement.updateOne({ _id: id }, { $set: { 'delivery.error': String(e.message).slice(0, 300), 'delivery.leaseUntil': null } });
    throw e;
  }
}

/**
 * Cron job body: publish scheduled announcements that are due, then (re)start any delivery
 * that is pending or was interrupted.
 */
export async function runAnnouncementsJob(now = new Date()) {
  const due = await Announcement.find({ status: 'scheduled', publishAt: { $lte: now } }).select('_id publishedBy updatedBy').lean();
  let published = 0;
  for (const a of due) {
    try {
      await publishAnnouncement(a._id, { id: a.updatedBy || a.publishedBy }, now);
      published += 1;
    } catch (e) {
      logger.warn(`Scheduled announcement ${a._id} not published: ${e.message}`);
    }
  }
  const waiting = await Announcement.find({
    status: 'published',
    'delivery.state': { $in: ['pending', 'running'] },
    $or: [{ 'delivery.leaseUntil': null }, { 'delivery.leaseUntil': { $lt: new Date() } }],
  })
    .select('_id')
    .lean();
  let delivered = 0;
  for (const a of waiting) {
    const result = await deliverAnnouncement(a._id).catch((e) => logger.error(`Announcement ${a._id} delivery failed: ${e.message}`));
    if (result) delivered += 1;
  }
  return { published, delivered };
}

/** What a member sees: live announcements for their audience, pinned first, newest next. */
export async function memberAnnouncements(memberId, { limit = 30 } = {}, now = new Date()) {
  const audiences = await memberAudiences(memberId);
  const filter = {
    status: 'published',
    publishAt: { $lte: now },
    audience: { $in: audiences },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
  const [items, total] = await Promise.all([
    Announcement.find(filter).sort({ pinned: -1, publishAt: -1 }).limit(limit).select('title body category imageUrl pinned publishAt expiresAt').lean(),
    Announcement.countDocuments(filter),
  ]);
  return { items, total };
}

export async function memberAnnouncement(memberId, id, now = new Date()) {
  const audiences = await memberAudiences(memberId);
  const a = await Announcement.findOne({
    _id: id,
    status: 'published',
    publishAt: { $lte: now },
    audience: { $in: audiences },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .select('title body category imageUrl pinned publishAt expiresAt')
    .lean();
  if (!a) throw new AppError('This announcement is no longer available', 404, 'NOT_FOUND');
  return a;
}
