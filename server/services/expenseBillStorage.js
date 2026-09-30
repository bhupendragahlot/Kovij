/**
 * Private storage for expense bills (photos or PDFs). Files live under uploads/private and are
 * only ever streamed to staff with `expenses.manage` through the expense routes.
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UPLOAD_ROOT } from './storageService.js';
import { AppError } from '../middleware/errorHandler.js';

const BILL_DIR = path.join(UPLOAD_ROOT, 'private', 'expense-bills');
const REF_PREFIX = 'private:expense-bills/';
export const BILL_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
export const MAX_BILL_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(BILL_DIR, { recursive: true });
    cb(null, BILL_DIR);
  },
  // Random name; the extension comes from the checked MIME type, never from the client's filename.
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${BILL_TYPES[file.mimetype]}`),
});

export const uploadBill = multer({
  storage,
  limits: { fileSize: MAX_BILL_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!BILL_TYPES[file.mimetype]) {
      return cb(new AppError('Bill must be a photo (JPEG, PNG, WebP) or a PDF', 422, 'VALIDATION_ERROR', { fields: { bill: 'Use a photo or a PDF' } }));
    }
    cb(null, true);
  },
}).single('bill');

export const billRefFor = (file) => `${REF_PREFIX}${file.filename}`;

/** Absolute path for a stored bill reference, or null if the reference is not a bill. */
export function billPath(ref) {
  if (!ref || !String(ref).startsWith(REF_PREFIX)) return null;
  return path.join(BILL_DIR, path.basename(ref));
}

/** Best-effort removal of a replaced or orphaned bill file. */
export function removeBillFile(ref) {
  const file = billPath(ref);
  if (file) fs.promises.unlink(file).catch(() => {});
}
