import { asyncHandler } from '../utils/asyncHandler.js';
import { financeOverview } from '../services/financeService.js';

/** GET /api/admin/finance/overview?month=YYYY-MM */
export const overview = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await financeOverview({ month: req.validated.query.month })) });
});
