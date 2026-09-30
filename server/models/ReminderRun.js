import mongoose from 'mongoose';

/**
 * One run of the reminder engine (scheduled, or "Send now" by staff). Doubles as the run lock:
 * while a run is going its `lock` field is set, and a unique index allows only one such row.
 * Sends themselves are de-duplicated by Notification.dedupeKey, so a crashed run can simply be
 * run again.
 */
const reminderRunSchema = new mongoose.Schema(
  {
    /** Gym day (`YYYY-MM-DD`) the run was for. */
    dayKey: { type: String, required: true },
    trigger: { type: String, enum: ['schedule', 'manual', 'test'], required: true },
    status: { type: String, enum: ['running', 'done', 'failed'], default: 'running' },
    lock: { type: String },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    /** The moment the rules were evaluated for (equals startedAt except in tests). */
    asOf: { type: Date },
    /** { expiry_reminder: { sent, alreadySent, failed }, … } */
    byKind: { type: mongoose.Schema.Types.Mixed, default: {} },
    totals: {
      sent: { type: Number, default: 0 },
      alreadySent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    housekeeping: {
      expired: { type: Number, default: 0 },
      started: { type: Number, default: 0 },
    },
    error: { type: String, default: '' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

reminderRunSchema.index({ lock: 1 }, { unique: true, partialFilterExpression: { lock: { $type: 'string' } } });
reminderRunSchema.index({ dayKey: 1, trigger: 1, status: 1 });
reminderRunSchema.index({ startedAt: -1 });

export default mongoose.model('ReminderRun', reminderRunSchema);
