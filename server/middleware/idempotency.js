import crypto from 'crypto';
import IdempotencyKey from '../models/IdempotencyKey.js';
import { AppError } from './errorHandler.js';
import { stableStringify } from '../utils/strings.js';
import { logger } from '../utils/logger.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const LOCK_MS = 60 * 1000;

function actorScope(req) {
  if (req.staffUser?.id) return `staff:${req.staffUser.id}`;
  if (req.member?.memberId) return `member:${req.member.memberId}`;
  return `ip:${req.ip}`;
}

function fingerprint(req) {
  const payload = `${req.method} ${req.baseUrl}${req.path}\n${stableStringify(req.body ?? null)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Makes a mutating endpoint safe to retry. The client sends a unique `Idempotency-Key`
 * per logical operation (one payment, one registration) and reuses it on every retry.
 *
 *  - First request: executes, and the response (2xx or 4xx) is stored for 24h.
 *  - Retry with same key + same body: the stored response is replayed; nothing runs twice.
 *  - Same key + different body: 422, because that is a client bug, not a retry.
 *  - Retry while the first is still running: 409 with Retry-After.
 *  - 5xx: the record is dropped so the client can safely retry the same key.
 *
 * Place it after auth (the key is scoped per user) and after body validation (so a
 * rejected payload never consumes a key).
 */
export function idempotent({ required = true } = {}) {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key');
    if (!key) {
      if (!required) return next();
      return next(new AppError('Idempotency-Key header is required for this request', 400, 'IDEMPOTENCY_KEY_REQUIRED'));
    }
    if (!KEY_PATTERN.test(key)) {
      return next(new AppError('Idempotency-Key must be 16–128 letters, digits, dashes or underscores', 400, 'IDEMPOTENCY_KEY_INVALID'));
    }

    const scope = actorScope(req);
    const requestHash = fingerprint(req);
    const now = new Date();
    let record;

    try {
      record = await IdempotencyKey.create({
        key,
        scope,
        method: req.method,
        path: `${req.baseUrl}${req.path}`,
        requestHash,
        lockedUntil: new Date(now.getTime() + LOCK_MS),
      });
    } catch (e) {
      if (e?.code !== 11000) return next(e);

      const existing = await IdempotencyKey.findOne({ scope, key }).lean();
      if (!existing) {
        res.set('Retry-After', '1');
        return next(new AppError('Retry the request', 409, 'IDEMPOTENCY_RETRY'));
      }
      if (existing.requestHash !== requestHash) {
        return next(new AppError('This Idempotency-Key was already used for a different request', 422, 'IDEMPOTENCY_KEY_REUSED'));
      }
      if (existing.state === 'completed') {
        res.set('Idempotent-Replayed', 'true');
        return res.status(existing.responseStatus).json(existing.responseBody);
      }
      // Still processing. Take over only if the original holder's lock went stale (crash mid-request).
      record = await IdempotencyKey.findOneAndUpdate(
        { _id: existing._id, state: 'processing', lockedUntil: { $lte: now } },
        { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
        { new: true }
      );
      if (!record) {
        res.set('Retry-After', '2');
        return next(new AppError('This request is still being processed', 409, 'IDEMPOTENCY_IN_PROGRESS'));
      }
    }

    req.idempotencyKey = key;
    const sendJson = res.json.bind(res);

    // Persist the outcome before the client sees it, so any retry after a response is a replay.
    res.json = (body) => {
      const status = res.statusCode;
      const finalize =
        status >= 500
          ? IdempotencyKey.deleteOne({ _id: record._id })
          : IdempotencyKey.updateOne(
              { _id: record._id },
              { $set: { state: 'completed', responseStatus: status, responseBody: body } }
            );
      finalize
        .catch((err) => logger.error(`Idempotency finalize failed for ${key}: ${err.message}`))
        .finally(() => sendJson(body));
      return res;
    };

    next();
  };
}
