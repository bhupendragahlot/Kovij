import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';

/**
 * OWNER: member app content & support module (phase 2). Mounted at /api/admin/support.
 * Stub from the platform foundation; the owning module replaces it with real routes.
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth);

export default router;
