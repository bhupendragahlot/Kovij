import { getSettingsDoc } from '../models/Settings.js';
import { buildDashboard } from '../services/dashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** GET /api/admin/dashboard */
export const getDashboard = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  const dashboard = await buildDashboard({
    canSeeRevenue: ['admin', 'manager'].includes(req.staffUser.role),
    expiringWindowDays: settings.expiringWindowDays,
  });
  res.json({ success: true, ...dashboard });
});
