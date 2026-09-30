import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';

/**
 * OWNER: security, staff & settings module. Mounted at /api/admin/activity.
 * Stub from the platform foundation; the owning module replaces it with real routes.
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth);

export default router;
