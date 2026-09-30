import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';

/**
 * OWNER: member app core module (phase 2). Mounted at /api/member/home.
 * Stub from the platform foundation; the owning module replaces it with real routes.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

export default router;
