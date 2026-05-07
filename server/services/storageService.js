import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadRoot = path.join(__dirname, '..', 'uploads', 'members');

function ensureDir() {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir();
    cb(null, uploadRoot);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype) || file.mimetype === 'application/pdf';
  if (!ok) {
    return cb(new Error('Only JPEG, PNG, WebP, GIF, or PDF allowed'));
  }
  cb(null, true);
};

/** Multer instance for profile photo + ID proof (max 5MB each) */
export const uploadMemberFiles = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter,
});

/** Public URL path (served by Express static) */
export function fileUrlFromFilename(filename) {
  if (!filename) return '';
  return `/uploads/members/${filename}`;
}
