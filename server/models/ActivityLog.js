import mongoose from 'mongoose';

/** Kept for 180 days, then removed by MongoDB (TTL index on `at`). */
export const ACTIVITY_RETENTION_DAYS = 180;

/**
 * One staff change (POST/PUT/PATCH/DELETE) recorded by middleware/activityLog.js.
 * Deliberately holds no request bodies, passwords, tokens, health data or card details:
 * only who, what kind of change, on which record, how it ended, and from where.
 */
const activityLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, trim: true },
      role: { type: String, trim: true },
    },
    method: { type: String, enum: ['POST', 'PUT', 'PATCH', 'DELETE'] },
    /** Route pattern with ids replaced, e.g. /admin/members/:id/memberships */
    route: { type: String, trim: true },
    /** Stable key from services/activityService.js ACTIONS, e.g. payment.collect */
    action: { type: String, trim: true },
    /** create | update | delete | other, for filtering */
    kind: { type: String, enum: ['create', 'update', 'delete', 'other'] },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
    /** Money moved, when the response reports it (INR). */
    amount: { type: Number },
    status: { type: Number },
    ok: { type: Boolean },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { versionKey: false }
);

activityLogSchema.index({ at: 1 }, { expireAfterSeconds: ACTIVITY_RETENTION_DAYS * 86400 });
activityLogSchema.index({ 'actor.id': 1, at: -1 });
activityLogSchema.index({ memberId: 1, at: -1 });
activityLogSchema.index({ entityType: 1, at: -1 });

export default mongoose.model('ActivityLog', activityLogSchema);
