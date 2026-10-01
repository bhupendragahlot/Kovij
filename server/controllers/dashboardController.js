import { getSettingsDoc } from '../models/Settings.js';
import { buildDashboard } from '../services/dashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { can } from '../config/permissions.js';

/** GET /api/admin/dashboard */
export const getDashboard = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  const { role } = req.staffUser;
  const dashboard = await buildDashboard({
    canSeeRevenue: can(role, 'revenue.view'),
    canSeeDues: can(role, 'payments.view'),
    canSeeSupport: can(role, 'support.manage'),
    expiringWindowDays: settings.expiringWindowDays,
  });
  res.json({ success: true, ...dashboard });
});
