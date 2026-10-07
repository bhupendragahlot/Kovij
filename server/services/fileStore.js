/**
 * Where uploaded files (gym logo, member and trainer photos, ID proofs, expense bills, progress
 * photos) are kept.
 *
 * Default: MongoDB GridFS (bucket "uploads"), in the same database as everything else. Hosting
 * disks are often temporary: Render wipes a service's files on every deploy and restart, which
 * is how uploaded logos and photos used to vanish. FILE_STORE=disk keeps files under UPLOAD_ROOT
 * instead, for a server with a persistent disk.
 *
 * Files are addressed by a key that mirrors the old folder layout under UPLOAD_ROOT, so stored
 * references never change: "public/avatars/<name>", "private/id-proofs/<name>",
 * "private/expense-bills/<name>", "private/progress-photos/<name>", "members/<name>" (legacy).
 * Reads fall back to a file on disk with the same key, so files saved before GridFS still work
 * wherever they survive (local development).
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const BUCKET = 'uploads';
const SAFE_KEY = /^(public\/avatars|private\/id-proofs|private\/expense-bills|private\/progress-photos|members)\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/;

let uploadRoot = '';
/** storageService tells us the disk root (kept there so tests and env overrides stay in one place). */
export function setUploadRoot(root) {
  uploadRoot = root;
}

export const useDisk = () => String(process.env.FILE_STORE || '').trim().toLowerCase() === 'disk';

/** A key is only ever built by this server; refuse anything else (no path tricks). */
export function assertKey(key) {
  if (typeof key !== 'string' || !SAFE_KEY.test(key)) throw new Error(`Invalid file key: ${String(key).slice(0, 80)}`);
  return key;
}

const diskPath = (key) => path.join(uploadRoot, ...assertKey(key).split('/'));

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database is not connected');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

/** Save a file. Replaces nothing: callers always use fresh random names. */
export async function saveFile(key, buffer, { contentType = 'application/octet-stream' } = {}) {
  assertKey(key);
  if (useDisk()) {
    const file = diskPath(key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, buffer, { flag: 'wx' });
    return;
  }
  await new Promise((resolve, reject) => {
    const up = bucket().openUploadStream(key, { metadata: { contentType } });
    up.once('finish', resolve).once('error', reject);
    up.end(buffer);
  });
}

async function latestGridFile(key) {
  return bucket().find({ filename: key }).sort({ uploadDate: -1 }).limit(1).next();
}

/**
 * The stored file, or null if there is none: { stream(), contentType, length }.
 * GridFS first (unless FILE_STORE=disk), then the disk copy.
 */
export async function openFile(key) {
  assertKey(key);
  if (!useDisk()) {
    const doc = await latestGridFile(key);
    if (doc) {
      return { length: doc.length, contentType: doc.metadata?.contentType || 'application/octet-stream', stream: () => bucket().openDownloadStream(doc._id) };
    }
  }
  const file = diskPath(key);
  try {
    const stat = await fs.promises.stat(file);
    if (!stat.isFile()) return null;
    return { length: stat.size, contentType: contentTypeFor(file), stream: () => fs.createReadStream(file) };
  } catch {
    return null;
  }
}

export async function fileExists(key) {
  return Boolean(await openFile(key));
}

/** Delete every stored copy. Never throws (a missing file is already the goal). */
export async function removeFile(key) {
  try {
    assertKey(key);
  } catch {
    return;
  }
  if (!useDisk()) {
    try {
      const b = bucket();
      const docs = await b.find({ filename: key }).project({ _id: 1 }).toArray();
      for (const d of docs) await b.delete(d._id);
    } catch (e) {
      logger.warn(`Couldn't remove stored file ${key}: ${e.message}`);
    }
  }
  await fs.promises.unlink(diskPath(key)).catch(() => {});
}

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };
export const contentTypeFor = (name) => TYPES[path.extname(String(name)).toLowerCase()] || 'application/octet-stream';

/**
 * Stream a stored file to the response, or answer 404. `cache` sets Cache-Control (private files
 * pass "private, no-store"); `disposition` e.g. 'inline; filename="bill.pdf"'.
 */
export async function sendStoredFile(res, key, { cache = 'private, no-store', disposition } = {}) {
  let file;
  try {
    file = key ? await openFile(key) : null;
  } catch (e) {
    logger.warn(`Couldn't read stored file: ${e.message}`);
    file = null;
  }
  if (!file) {
    res.status(404).json({ success: false, message: 'File not found', code: 'NOT_FOUND' });
    return false;
  }
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', String(file.length));
  res.setHeader('Cache-Control', cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (disposition) res.setHeader('Content-Disposition', disposition);
  await new Promise((resolve) => {
    const stream = file.stream();
    stream.once('error', () => {
      res.destroy();
      resolve();
    });
    stream.once('end', resolve);
    stream.pipe(res);
  });
  return true;
}
