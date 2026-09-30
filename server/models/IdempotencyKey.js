import mongoose from 'mongoose';

/**
 * One row per (actor, Idempotency-Key). Stores the first response so retries of the
 * same request replay it instead of repeating the side effect (e.g. charging twice).
 * Rows expire after 24 hours via a TTL index.
 */
const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true },
  scope: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  requestHash: { type: String, required: true },
  state: { type: String, enum: ['processing', 'completed'], default: 'processing' },
  lockedUntil: { type: Date, required: true },
  responseStatus: { type: Number },
  responseBody: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

idempotencyKeySchema.index({ scope: 1, key: 1 }, { unique: true });

export default mongoose.model('IdempotencyKey', idempotencyKeySchema);
