import {
  audienceSize,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  listAnnouncements,
  memberAnnouncement,
  memberAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
} from '../services/announcementService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ── Staff (/api/admin/announcements) ─────────────────────────────────────────

/** GET / — list with per-status counts and delivery stats. */
export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listAnnouncements(req.validated.query)) });
});

/** GET /audience?audience=all — how many members it would reach. */
export const audience = asyncHandler(async (req, res) => {
  res.json({ success: true, audience: req.validated.query.audience, ...(await audienceSize(req.validated.query.audience)) });
});

/** GET /:id */
export const getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, announcement: await getAnnouncement(req.params.id) });
});

/** POST / — always saved as a draft; publish is a separate, idempotent step. */
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, announcement: await createAnnouncement(req.validated.body, req.staffUser) });
});

/** PATCH /:id */
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, announcement: await updateAnnouncement(req.params.id, req.validated.body, req.staffUser) });
});

/** POST /:id/publish — goes live now, or at publishAt when that is in the future. */
export const publish = asyncHandler(async (req, res) => {
  res.json({ success: true, announcement: await publishAnnouncement(req.params.id, req.staffUser) });
});

/** POST /:id/unpublish */
export const unpublish = asyncHandler(async (req, res) => {
  res.json({ success: true, announcement: await unpublishAnnouncement(req.params.id, req.staffUser) });
});

/** DELETE /:id — drafts only. */
export const remove = asyncHandler(async (req, res) => {
  await deleteAnnouncement(req.params.id);
  res.json({ success: true });
});

// ── Member app (/api/member/announcements) ───────────────────────────────────

/** GET / — live announcements for this member, pinned first. */
export const memberList = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
  res.json({ success: true, ...(await memberAnnouncements(req.member.memberId, { limit })) });
});

/** GET /:id */
export const memberGetOne = asyncHandler(async (req, res) => {
  res.json({ success: true, announcement: await memberAnnouncement(req.member.memberId, req.params.id) });
});
