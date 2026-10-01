import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { notComingInQuery, reportPeriodQuery } from '../../validators/report.schema.js';
import { exportNotComingIn, exportRenewals, getNotComingIn, getOverview } from '../../controllers/reportController.js';

/** OWNER: reports & dashboard module. Mounted at /api/admin/reports. */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('reports.view'));

router.get('/overview', validate(reportPeriodQuery, 'query'), getOverview);
router.get('/not-coming-in', validate(notComingInQuery, 'query'), getNotComingIn);
router.get('/renewals.csv', validate(reportPeriodQuery, 'query'), exportRenewals);
router.get('/not-coming-in.csv', validate(reportPeriodQuery, 'query'), exportNotComingIn);

export default router;
