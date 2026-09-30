/**
 * Private progress photos: one per member, day and pose (front, side, back).
 *
 * Files are written under uploads/private/progress-photos (never served statically) and are
 * only streamed through authenticated routes. The type is checked from the file's own bytes,
 * not from what the client claims, and names are random so nothing about the member leaks
 * through a file name.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import ProgressPhoto from '../models/ProgressPhoto.js';
import { UPLOAD_ROOT, sniffImageType } from './storageService.js';
import { AppError } from '../middleware/errorHandler.js';
import { gymDayKey } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { dayBounds, dayOffset } from './wellnessMath.js';

export const PHOTO_POLICY = {
  maxBytes: 5 * 1024 * 1024, // matches the errorHandler's "larger than 5 MB" message
  maxPerMember: 300, // 100 check-ins × 3 poses
  backdateDays: 365,
};

const PHOTO_DIR = path.join(UPLOAD_ROOT, 'private', 'progress-photos');
const REF_PREFIX = 'private:progress-photos/';
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const TYPE_MESSAGE = 'Photo must be a JPEG, PNG or WebP image';
const typeError = () => new AppError(TYPE_MESSAGE, 422, 'INVALID_FILE_TYPE', { fields: { photo: 'Choose a JPEG, PNG or WebP photo' } });

/** Image type from the file's own bytes; null unless it is a JPEG, PNG or WebP (no GIFs). */
export function detectImageType(buf) {
  const type = sniffImageType(buf);
  return EXT[type] ? type : null;
}

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PHOTO_POLICY.maxBytes, files: 1, fields: 4, fieldSize: 200, parts: 6 },
  fileFilter: (req, file, cb) => {
    if (!EXT[file.mimetype]) return cb(typeError());
    cb(null, true);
  },
}).single('photo');

/** Multipart parser for one `photo` file plus `day` and `pose`, with plain-language errors. */
export function receivePhoto(req, res, next) {
  receive(req, res, (err) => {
    if (!err) return next();
    if (err instanceof AppError) return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Photo is larger than 5 MB. Choose a smaller photo.', 413, 'FILE_TOO_LARGE', { fields: { photo: 'Choose a photo under 5 MB' } }));
    }
    if (err instanceof multer.MulterError) return next(new AppError('Send one photo in the "photo" field', 400, 'INVALID_UPLOAD', { fields: { photo: 'Choose one photo' } }));
    next(err);
  });
}

const absolutePath = (ref) => (ref?.startsWith(REF_PREFIX) ? path.join(PHOTO_DIR, path.basename(ref.slice(REF_PREFIX.length))) : null);

async function removeFile(ref) {
  const file = absolutePath(ref);
  if (!file) return;
  try {
    await fs.unlink(file);
  } catch (e) {
    if (e.code !== 'ENOENT') logger.warn(`Couldn't remove a progress photo file: ${e.code || e.message}`);
  }
}

export function presentPhoto(p, urlBase) {
  return {
    _id: p._id,
    day: p.day,
    pose: p.pose,
    mime: p.mime,
    bytes: p.bytes,
    uploadedByKind: p.uploadedByKind,
    uploadedByName: p.uploadedByName || '',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    /** Path under /api; fetch it with the same token (it is not a public link). */
    url: `${urlBase}/${p._id}/file`,
  };
}

/** Photos newest day first, plus the list of days that have any, for the comparison picker. */
export async function listPhotos(memberId, urlBase) {
  const rows = await ProgressPhoto.find({ memberId }).sort({ date: -1, pose: 1 }).lean();
  const photos = rows.map((p) => presentPhoto(p, urlBase));
  const days = [...new Set(photos.map((p) => p.day))];
  return { photos, days, total: photos.length };
}

/**
 * Save (or replace) the photo for a day and pose. The new file is written first; the old one is
 * removed only after the database points at the new one, so a failure never loses a photo.
 */
export async function savePhoto({ memberId, day: dayInput, pose, file, actor, urlBase, now = new Date() }) {
  if (!file?.buffer?.length) throw new AppError('Choose a photo to upload', 422, 'VALIDATION_ERROR', { fields: { photo: 'Choose a photo' } });
  const mime = detectImageType(file.buffer);
  if (!mime) throw typeError();

  const day = dayInput || gymDayKey(now);
  const offset = dayOffset(day, now);
  if (offset > 0 || offset < -PHOTO_POLICY.backdateDays) {
    throw new AppError('Choose today or a date within the last year', 422, 'VALIDATION_ERROR', { fields: { day: 'Choose today or a date within the last year' } });
  }

  const replacing = await ProgressPhoto.exists({ memberId, day, pose });
  if (!replacing && (await ProgressPhoto.countDocuments({ memberId })) >= PHOTO_POLICY.maxPerMember) {
    throw new AppError(`This member has ${PHOTO_POLICY.maxPerMember} photos. Delete old ones before adding more.`, 409, 'TOO_MANY_PHOTOS');
  }

  await fs.mkdir(PHOTO_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${EXT[mime]}`;
  const ref = `${REF_PREFIX}${name}`;
  await fs.writeFile(path.join(PHOTO_DIR, name), file.buffer, { flag: 'wx' });

  const set = {
    date: dayBounds(day).start,
    file: ref,
    mime,
    bytes: file.buffer.length,
    uploadedByKind: actor.kind,
    uploadedBy: actor.id,
    uploadedByName: actor.name || '',
  };
  let previous;
  try {
    const save = () => ProgressPhoto.findOneAndUpdate({ memberId, day, pose }, { $set: set }, { upsert: true, new: false, runValidators: true }).lean();
    try {
      previous = await save();
    } catch (e) {
      if (e?.code !== 11000) throw e;
      previous = await save(); // two uploads of the same pose at once: the second replaces the first
    }
  } catch (e) {
    await removeFile(ref);
    throw e;
  }
  if (previous?.file && previous.file !== ref) await removeFile(previous.file);

  const saved = await ProgressPhoto.findOne({ memberId, day, pose }).lean();
  return { photo: presentPhoto(saved, urlBase), replaced: Boolean(previous) };
}

/** The file to stream, after checking the photo belongs to this member. */
export async function photoFile(memberId, photoId) {
  const photo = await ProgressPhoto.findOne({ _id: photoId, memberId }).lean();
  const file = absolutePath(photo?.file);
  if (!file) throw new AppError('Photo not found', 404, 'NOT_FOUND');
  try {
    await fs.access(file);
  } catch {
    throw new AppError('Photo not found', 404, 'NOT_FOUND');
  }
  return { file, mime: photo.mime };
}

export async function deletePhoto(memberId, photoId) {
  const photo = await ProgressPhoto.findOneAndDelete({ _id: photoId, memberId }).lean();
  if (!photo) throw new AppError('Photo not found', 404, 'NOT_FOUND');
  await removeFile(photo.file);
}

/** Stream a private photo with headers that keep it out of shared caches and stop sniffing. */
export function sendPhoto(res, { file, mime }) {
  res.set({
    'Content-Type': mime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  });
  res.sendFile(file);
}
