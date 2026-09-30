import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { getDashboard } from '../../controllers/dashboardController.js';

/** OWNER: reports & dashboard module. Mounted at /api/admin/dashboard. */
const router = express.Router();
router.use(adminAuth);

router.get('/', getDashboard);

export default router;
