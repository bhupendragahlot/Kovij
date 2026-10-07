import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { removeFile, saveFile, setUploadRoot } from './fileStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Disk folder for FILE_STORE=disk and for files saved before uploads moved into the database
 * (see fileStore.js). Tests (NODE_ENV=test) use the throwaway working directory the e2e runner
 * creates, so they never leave files in the repository.
 */
export const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : process.env.NODE_ENV === 'test'
    ? path.join(process.cwd(), 'uploads')
    : path.join(__dirname, '..', 'uploads');
setUploadRoot(UPLOAD_ROOT);

/** Public profile photos and the gym logo are served at /uploads/avatars/<name>. */
export const AVATAR_URL_PREFIX = '/uploads/avatars/';
const AVATAR_KEY = 'public/avatars/';
const ID_PROOF_KEY = 'private/id-proofs/';
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' };
const IMAGE_TYPES = Object.keys(EXTENSIONS).filter((m) => m !== 'application/pdf');

/** Random name; the extension comes from the checked type, never from the client's filename. */
export const newFileName = (mime) => `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSIONS[mime] || ''}`;

/**
 * Magic-byte check: the declared MIME type is only a claim from the browser. Returns the real
 * image type, or null if the bytes aren't a JPEG, PNG, WebP or GIF.
 */
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  const gif = buf.subarray(0, 6).toString('latin1');
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
  return null;
}

/** Real type of an image or PDF from its bytes, or null. */
export function sniffDocumentType(buf) {
  if (buf && buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return sniffImageType(buf);
}

const fileFilter = (req, file, cb) => {
  const allowed = file.fieldname === 'idProof' ? Object.keys(EXTENSIONS) : IMAGE_TYPES;
  if (!allowed.includes(file.mimetype)) {
    const message = file.fieldname === 'idProof' ? 'ID proof must be JPEG, PNG, WebP, GIF or PDF' : 'Photo must be JPEG, PNG, WebP or GIF';
    return cb(new AppError(message, 422, 'INVALID_FILE_TYPE', { fields: { [file.fieldname]: message } }));
  }
  cb(null, true);
};

// Held in memory (5 MB at most), checked, then saved to the file store.
const memberFiles = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 2 }, fileFilter });
const avatarUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 5 }, fileFilter }).single('photo');

/** Check one received file's bytes and save it; sets `file.filename` (used by fileRefFor). */
async function persist(file) {
  const isIdProof = file.fieldname === 'idProof';
  const real = isIdProof ? sniffDocumentType(file.buffer) : sniffImageType(file.buffer);
  if (!real) {
    const message = isIdProof ? 'That file isn’t a photo or PDF we can use.' : 'That file isn’t a photo we can use. Choose a JPEG, PNG or WebP image.';
    throw new AppError(message, 422, 'INVALID_FILE_TYPE', { fields: { [file.fieldname]: message } });
  }
  file.mimetype = real;
  file.filename = newFileName(real);
  await saveFile(`${isIdProof ? ID_PROOF_KEY : AVATAR_KEY}${file.filename}`, file.buffer, { contentType: real });
  file.buffer = undefined;
}

/** Multer middleware followed by checking and saving every received file. */
function thenPersist(receive) {
  return (req, res, next) => {
    receive(req, res, (err) => {
      if (err) return next(err);
      const files = [req.file, ...Object.values(req.files || {}).flat()].filter(Boolean);
      Promise.all(files.map(persist)).then(() => next(), next);
    });
  };
}

/**
 * Profile photo + ID proof (max 5 MB each), for the member's own uploads and trainer photos:
 *   uploadMemberFiles.fields([{ name: 'profilePhoto' }, { name: 'idProof' }]) / .single('photo')
 */
export const uploadMemberFiles = {
  fields: (spec) => thenPersist(memberFiles.fields(spec)),
  single: (field) => thenPersist(memberFiles.single(field)),
};

/**
 * Express middleware for one staff-uploaded profile photo (or the gym logo) in the multipart
 * field `photo`. Sets `req.avatarUrl` (public URL) once the file is verified and saved.
 * Multer's own errors become clear 4xx messages instead of a 500.
 */
export function avatarUpload(req, res, next) {
  avatarUploader(req, res, (err) => {
    if (err) {
      if (err instanceof AppError) return next(err);
      if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('Photo is larger than 5 MB. Choose a smaller photo.', 413, 'FILE_TOO_LARGE', { fields: { photo: 'Choose a photo under 5 MB' } }));
      if (err instanceof multer.MulterError) {
        return next(new AppError('Send one photo in the "photo" field', 400, 'INVALID_UPLOAD', { fields: { photo: 'Choose one photo' } }));
      }
      return next(err);
    }
    if (!req.file) return next(new AppError('Choose a photo to upload', 422, 'VALIDATION_ERROR', { fields: { photo: 'Choose a photo' } }));
    const real = sniffImageType(req.file.buffer);
    if (!real || real !== req.file.mimetype) {
      return next(new AppError('That file isn’t a photo we can use. Choose a JPEG, PNG or WebP image.', 422, 'INVALID_FILE_TYPE', { fields: { photo: 'Choose a JPEG, PNG or WebP photo' } }));
    }
    req.file.filename = newFileName(real);
    saveFile(`${AVATAR_KEY}${req.file.filename}`, req.file.buffer, { contentType: real })
      .then(() => {
        req.file.buffer = undefined;
        req.avatarUrl = `${AVATAR_URL_PREFIX}${req.file.filename}`;
        next();
      })
      .catch((e) => {
        logger.error(`Couldn't save an uploaded photo: ${e.message}`);
        next(new AppError('The photo couldn’t be saved. Try again.', 503, 'UPLOAD_FAILED'));
      });
  });
}

/** The stored-file key behind a public avatar URL, or null for anything else. */
export function avatarKey(url) {
  if (typeof url !== 'string' || !url.startsWith(AVATAR_URL_PREFIX)) return null;
  const file = path.basename(url);
  return file && !file.startsWith('.') ? `${AVATAR_KEY}${file}` : null;
}

/** Delete an avatar we stored (e.g. when it is replaced). Ignores anything else. */
export async function removeAvatar(url) {
  const key = avatarKey(url);
  if (key) await removeFile(key);
}

/** Reference stored in the database for an uploaded file. */
export function fileRefFor(file) {
  if (!file) return '';
  return file.fieldname === 'idProof' ? `private:id-proofs/${file.filename}` : `${AVATAR_URL_PREFIX}${file.filename}`;
}

/** Stored-file key for a private reference (new `private:` refs or legacy /uploads/members paths). */
export function privateFileKey(ref) {
  if (!ref) return null;
  if (ref.startsWith('private:id-proofs/')) return `${ID_PROOF_KEY}${path.basename(ref)}`;
  if (ref.startsWith('/uploads/members/')) return `members/${path.basename(ref)}`;
  return null;
}
