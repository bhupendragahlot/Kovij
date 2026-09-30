import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Where uploads live. Tests (NODE_ENV=test) write into the throwaway working directory the e2e
 * runner creates, so they never leave files in the repository.
 */
export const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : process.env.NODE_ENV === 'test'
    ? path.join(process.cwd(), 'uploads')
    : path.join(__dirname, '..', 'uploads');
/** Served publicly at /uploads/avatars. */
export const PUBLIC_AVATAR_DIR = path.join(UPLOAD_ROOT, 'public', 'avatars');
/** Never served statically; streamed to staff through an authenticated route. */
const PRIVATE_DIR = path.join(UPLOAD_ROOT, 'private');
const ID_PROOF_DIR = path.join(PRIVATE_DIR, 'id-proofs');
/** Pre-2026 uploads (avatars and ID proofs mixed together). */
export const LEGACY_MEMBER_DIR = path.join(UPLOAD_ROOT, 'members');

export const AVATAR_URL_PREFIX = '/uploads/avatars/';
const MAX_BYTES = 5 * 1024 * 1024;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' };
const IMAGE_TYPES = Object.keys(EXTENSIONS).filter((m) => m !== 'application/pdf');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'idProof' ? ID_PROOF_DIR : PUBLIC_AVATAR_DIR;
    ensureDir(dir);
    cb(null, dir);
  },
  // Random name + extension derived from the verified MIME type, never from the client's filename.
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXTENSIONS[file.mimetype]}`),
});

const fileFilter = (req, file, cb) => {
  const allowed = file.fieldname === 'idProof' ? Object.keys(EXTENSIONS) : IMAGE_TYPES;
  if (!allowed.includes(file.mimetype)) {
    const message = file.fieldname === 'idProof' ? 'ID proof must be JPEG, PNG, WebP, GIF or PDF' : 'Photo must be JPEG, PNG, WebP or GIF';
    return cb(new AppError(message, 422, 'INVALID_FILE_TYPE', { fields: { [file.fieldname]: message } }));
  }
  cb(null, true);
};

/** Multer instance for profile photo + ID proof (max 5MB each) */
export const uploadMemberFiles = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 2 },
  fileFilter,
});

const avatarUploader = multer({ storage, limits: { fileSize: MAX_BYTES, files: 1, fields: 5 }, fileFilter }).single('photo');

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

function readHead(filePath, bytes = 16) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

const removeQuietly = (filePath) => fs.promises.unlink(filePath).catch(() => {});

/**
 * Express middleware for one staff-uploaded profile photo in the multipart field `photo`.
 * Sets `req.avatarUrl` (public URL) once the file is saved and verified as a real image.
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
    let real = null;
    try {
      real = sniffImageType(readHead(req.file.path));
    } catch (e) {
      logger.warn(`avatar sniff failed: ${e.message}`);
    }
    if (!real || real !== req.file.mimetype) {
      removeQuietly(req.file.path);
      return next(new AppError('That file isn’t a photo we can use. Choose a JPEG, PNG or WebP image.', 422, 'INVALID_FILE_TYPE', { fields: { photo: 'Choose a JPEG, PNG or WebP photo' } }));
    }
    req.avatarUrl = `${AVATAR_URL_PREFIX}${req.file.filename}`;
    next();
  });
}

/** Delete an avatar we stored (e.g. when it is replaced). Ignores anything outside the avatar folder. */
export async function removeAvatar(url) {
  if (typeof url !== 'string' || !url.startsWith(AVATAR_URL_PREFIX)) return;
  const file = path.basename(url);
  if (!file || file.startsWith('.')) return;
  await removeQuietly(path.join(PUBLIC_AVATAR_DIR, file));
}

/** Reference stored in the database for an uploaded file. */
export function fileRefFor(file) {
  if (!file) return '';
  return file.fieldname === 'idProof' ? `private:id-proofs/${file.filename}` : `${AVATAR_URL_PREFIX}${file.filename}`;
}

/** Absolute path for a private file reference (new `private:` refs or legacy /uploads/members paths). */
export function privateUploadPath(ref) {
  if (!ref) return null;
  if (ref.startsWith('private:id-proofs/')) return path.join(ID_PROOF_DIR, path.basename(ref));
  if (ref.startsWith('/uploads/members/')) return path.join(LEGACY_MEMBER_DIR, path.basename(ref));
  return null;
}
