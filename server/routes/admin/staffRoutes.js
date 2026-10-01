import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParam } from '../../validators/common.js';
import { createStaffSchema, updateStaffSchema } from '../../validators/staff.schema.js';
import { listStaff, createStaff, updateStaff, sendStaffResetLink } from '../../controllers/staffController.js';
import { staffLoginLimiter } from '../../middleware/rateLimiter.js';

/** OWNER: security, staff & settings module. Mounted at /api/admin/staff. */
const router = express.Router();
router.use(adminAuth, requirePermission('staff.manage'));

router.get('/', listStaff);
router.post('/', validate(createStaffSchema), createStaff);
router.patch('/:id', validate(idParam, 'params'), validate(updateStaffSchema), updateStaff);
router.post('/:id/reset-link', staffLoginLimiter, validate(idParam, 'params'), sendStaffResetLink);

export default router;
