import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { activityQuery, signInQuery } from '../../validators/activity.schema.js';
import { listActivity, listSignIns } from '../../controllers/activityController.js';

/** OWNER: security, staff & settings module. Mounted at /api/admin/activity. */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('activity.view'));

router.get('/', validate(activityQuery, 'query'), listActivity);
router.get('/sign-ins', validate(signInQuery, 'query'), listSignIns);

export default router;
