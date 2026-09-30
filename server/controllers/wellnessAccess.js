import Member from '../models/Member.js';
import { AppError } from '../middleware/errorHandler.js';
import { can } from '../config/permissions.js';
import { isObjectId } from '../utils/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Shared wiring for the wellness routes (diet, progress, notes). Staff routes act on
 * `req.params.memberId`; member routes act on the signed-in member. Handlers only ever read
 * `req.subject` (whose data) and `req.actor` (who is acting), so one handler serves both.
 */

/** Staff route: the member in the URL must exist. Run after adminAuth and the permission check. */
export const loadMemberParam = asyncHandler(async (req, res, next) => {
  const { memberId } = req.params;
  if (!isObjectId(memberId) || !(await Member.exists({ _id: memberId }))) {
    throw new AppError('Member not found', 404, 'NOT_FOUND');
  }
  req.subject = { memberId: String(memberId) };
  req.actor = { kind: 'staff', id: req.staffUser.id, name: req.staffUser.name, role: req.staffUser.role };
  next();
});

/** Member route: the signed-in member must still exist. Run after memberAuth. */
export const loadSelf = asyncHandler(async (req, res, next) => {
  const memberId = req.member?.memberId;
  const member = isObjectId(memberId) ? await Member.findById(memberId).select('name').lean() : null;
  if (!member) throw new AppError('Your member account was not found. Sign in again.', 401, 'ACCOUNT_NOT_FOUND');
  req.subject = { memberId: String(member._id) };
  req.actor = { kind: 'member', id: String(member._id), name: member.name };
  next();
});

/** True when the acting staff member may see health data (members always see their own). */
export const canSeeHealth = (req) => req.actor?.kind === 'member' || can(req.staffUser?.role, 'members.health.view');

/** Roles that may remove any staff note, not just their own. */
export const NOTE_MODERATOR_ROLES = ['admin', 'manager'];
