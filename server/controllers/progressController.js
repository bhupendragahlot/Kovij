import { asyncHandler } from '../utils/asyncHandler.js';
import { addEntry, deleteEntry, progressOverview, updateEntry } from '../services/progressService.js';
import { deletePhoto, listPhotos, photoFile, savePhoto, sendPhoto } from '../services/progressPhotoService.js';

/**
 * Body measurements and progress photos. Handlers read `req.subject.memberId` and `req.actor`,
 * so the same code serves staff (/api/admin/members/:memberId/progress) and the member app
 * (/api/member/progress), where the member can only ever reach their own data.
 */

const photoBase = (req) =>
  req.actor.kind === 'member' ? '/member/progress/photos' : `/admin/members/${req.subject.memberId}/progress/photos`;

/** GET summary (first vs latest, BMI band), entries newest first with changes, default height. */
export const getProgress = asyncHandler(async (req, res) => {
  const limit = req.validated?.query?.limit;
  res.json({ success: true, ...(await progressOverview(req.subject.memberId, { limit })) });
});

/** GET entries only (member app list screen). */
export const listMeasurements = asyncHandler(async (req, res) => {
  const { entries, total } = await progressOverview(req.subject.memberId, { limit: req.validated.query.limit });
  res.json({ success: true, entries, total });
});

/** POST a measurement entry — idempotent; one entry per day. */
export const addMeasurement = asyncHandler(async (req, res) => {
  const entry = await addEntry({ memberId: req.subject.memberId, data: req.validated.body, actor: req.actor });
  res.status(201).json({ success: true, entry });
});

/** PATCH a measurement entry (`null` clears a field). */
export const updateMeasurement = asyncHandler(async (req, res) => {
  const entry = await updateEntry({ memberId: req.subject.memberId, entryId: req.validated.params.entryId, patch: req.validated.body, actor: req.actor });
  res.json({ success: true, entry });
});

/** DELETE a measurement entry. */
export const deleteMeasurement = asyncHandler(async (req, res) => {
  await deleteEntry({ memberId: req.subject.memberId, entryId: req.validated.params.entryId, actor: req.actor });
  res.json({ success: true });
});

/** GET photo list (metadata and private stream paths, never public links). */
export const listProgressPhotos = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listPhotos(req.subject.memberId, photoBase(req))) });
});

/** POST multipart: photo (file), pose, day. Replaces the photo for the same day and pose. */
export const uploadProgressPhoto = asyncHandler(async (req, res) => {
  const { day, pose } = req.validated.body;
  const result = await savePhoto({ memberId: req.subject.memberId, day, pose, file: req.file, actor: req.actor, urlBase: photoBase(req) });
  res.status(result.replaced ? 200 : 201).json({ success: true, ...result });
});

/** GET the image itself, only for this member's photo. */
export const streamProgressPhoto = asyncHandler(async (req, res) => {
  await sendPhoto(res, await photoFile(req.subject.memberId, req.validated.params.photoId));
});

/** DELETE a photo and its file. */
export const deleteProgressPhoto = asyncHandler(async (req, res) => {
  await deletePhoto(req.subject.memberId, req.validated.params.photoId);
  res.json({ success: true });
});
