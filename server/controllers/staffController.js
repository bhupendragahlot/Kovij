import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

/** GET /api/admin/staff */
export const listStaff = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: 1 });
  res.json({ success: true, staff: users.map((u) => u.toPublic()) });
});

/** POST /api/admin/staff — owner adds a staff account with a temporary password. */
export const createStaff = asyncHandler(async (req, res) => {
  const body = req.validated.body;
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

  Object.assign(user, patch);
  await user.save();
  res.json({ success: true, staff: user.toPublic() });
});
