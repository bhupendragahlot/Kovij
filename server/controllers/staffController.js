import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkLockout, passwordProblem, sendResetLink } from '../services/staffAuthService.js';

const passwordError = (problem) => new AppError(problem, 422, 'VALIDATION_ERROR', { fields: { password: problem } });

/** GET /api/admin/staff */
export const listStaff = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  const staff = await Promise.all(
    users.map(async (u) => {
      const lock = await checkLockout(u.email);
      return { ...u.toPublic(), lockedForMinutes: lock.locked ? lock.retryAfterMinutes : 0 };
    })
  );
  res.json({ success: true, staff });
});

/** POST /api/admin/staff — owner adds a staff account with a temporary password. */
export const createStaff = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const problem = passwordProblem(body.password, body);
  if (problem) throw passwordError(problem);
  const user = await User.create(body);
  res.status(201).json({ success: true, staff: user.toPublic() });
});

/** PATCH /api/admin/staff/:id */
export const updateStaff = asyncHandler(async (req, res) => {
  const patch = req.validated.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Staff account not found', 404, 'NOT_FOUND');

  const isSelf = String(user._id) === req.staffUser.id;
  if (isSelf && (patch.isActive === false || (patch.role && patch.role !== 'admin'))) {
    throw new AppError('You cannot deactivate or demote your own account', 409, 'SELF_LOCKOUT');
  }
  if (user.role === 'admin' && (patch.isActive === false || (patch.role && patch.role !== 'admin'))) {
    const otherAdmins = await User.countDocuments({ _id: { $ne: user._id }, role: 'admin', isActive: { $ne: false } });
    if (!otherAdmins) throw new AppError('Keep at least one active admin', 409, 'LAST_ADMIN');
  }
  if (patch.password) {
    const problem = passwordProblem(patch.password, user);
    if (problem) throw passwordError(problem);
    // A password set by the owner signs the person out everywhere.
    user.passwordChangedAt = new Date();
  }

  Object.assign(user, patch);
  await user.save();
  res.json({ success: true, staff: user.toPublic() });
});

/** POST /api/admin/staff/:id/reset-link — email them a link to choose their own password. */
export const sendStaffResetLink = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('Staff account not found', 404, 'NOT_FOUND');
  if (user.isActive === false) throw new AppError('Reactivate this account before sending a reset link', 409, 'ACCOUNT_INACTIVE');
  await sendResetLink({ user, requestedBy: req.staffUser.id, ip: req.ip });
  res.status(202).json({ success: true, message: `Reset link sent to ${user.email}. It works for 1 hour.` });
});
