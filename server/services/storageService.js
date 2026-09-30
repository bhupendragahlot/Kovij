import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
/** Served publicly at /uploads/avatars. */
export const PUBLIC_AVATAR_DIR = path.join(UPLOAD_ROOT, 'public', 'avatars');
/** Never served statically; streamed to staff through an authenticated route. */
const PRIVATE_DIR = path.join(UPLOAD_ROOT, 'private');
const ID_PROOF_DIR = path.join(PRIVATE_DIR, 'id-proofs');
/** Pre-2026 uploads (avatars and ID proofs mixed together). */
export const LEGACY_MEMBER_DIR = path.join(UPLOAD_ROOT, 'members');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' };

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
  const allowed = file.fieldname === 'idProof' ? Object.keys(EXTENSIONS) : Object.keys(EXTENSIONS).filter((m) => m !== 'application/pdf');
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error(file.fieldname === 'idProof' ? 'ID proof must be JPEG, PNG, WebP, GIF or PDF' : 'Photo must be JPEG, PNG, WebP or GIF'));
  }
  cb(null, true);
};

/** Multer instance for profile photo + ID proof (max 5MB each) */
export const uploadMemberFiles = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter,
});

/** Reference stored in the database for an uploaded file. */
export function fileRefFor(file) {
  if (!file) return '';
  return file.fieldname === 'idProof' ? `private:id-proofs/${file.filename}` : `/uploads/avatars/${file.filename}`;
}

/** Absolute path for a private file reference (new `private:` refs or legacy /uploads/members paths). */
export function privateUploadPath(ref) {
  if (!ref) return null;
  if (ref.startsWith('private:id-proofs/')) return path.join(ID_PROOF_DIR, path.basename(ref));
  if (ref.startsWith('/uploads/members/')) return path.join(LEGACY_MEMBER_DIR, path.basename(ref));
  return null;
}
