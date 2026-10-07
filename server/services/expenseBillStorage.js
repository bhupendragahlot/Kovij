/**
 * Private storage for expense bills (photos or PDFs), kept in the file store (fileStore.js) and
 * only ever streamed to staff with `expenses.manage` through the expense routes.
 */
import multer from 'multer';
import path from 'path';
import { newFileName, sniffDocumentType } from './storageService.js';
import { removeFile, saveFile } from './fileStore.js';
import { AppError } from '../middleware/errorHandler.js';

const KEY_PREFIX = 'private/expense-bills/';
const REF_PREFIX = 'private:expense-bills/';
export const BILL_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
export const MAX_BILL_BYTES = 5 * 1024 * 1024;

const typeError = () => new AppError('Bill must be a photo (JPEG, PNG, WebP) or a PDF', 422, 'VALIDATION_ERROR', { fields: { bill: 'Use a photo or a PDF' } });

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BILL_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (BILL_TYPES[file.mimetype] ? cb(null, true) : cb(typeError())),
}).single('bill');

/** Multipart field "bill": checked by its bytes, then saved. Sets `req.file.filename`. */
export function uploadBill(req, res, next) {
  receive(req, res, (err) => {
    if (err || !req.file) return next(err);
    const real = sniffDocumentType(req.file.buffer);
    if (!BILL_TYPES[real]) return next(typeError());
    req.file.mimetype = real;
    req.file.filename = newFileName(real);
    saveFile(`${KEY_PREFIX}${req.file.filename}`, req.file.buffer, { contentType: real })
      .then(() => {
        req.file.buffer = undefined;
        next();
      })
      .catch(next);
  });
}

export const billRefFor = (file) => `${REF_PREFIX}${file.filename}`;

/** Stored-file key for a bill reference, or null if the reference is not a bill. */
export function billKey(ref) {
  if (!ref || !String(ref).startsWith(REF_PREFIX)) return null;
  return `${KEY_PREFIX}${path.basename(ref)}`;
}

/** Best-effort removal of a replaced or orphaned bill file. */
export function removeBillFile(ref) {
  const key = billKey(ref);
  if (key) removeFile(key);
}
