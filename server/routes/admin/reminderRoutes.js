import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { previewQuery, reminderHistoryQuery, reminderSettingsSchema, statsQuery, testRunSchema } from '../../validators/engagement.schema.js';
import { getHistory, getOverview, getPreview, getStats, patchSettings, runNow, testRun } from '../../controllers/reminderController.js';

/**
 * OWNER: reminders, notifications & announcements module. Mounted at /api/admin/reminders.
 * Automatic reminders: status, dry-run preview, "Send now", history, per-stage stats, settings.
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('reminders.manage'));

router.get('/overview', getOverview);
router.get('/preview', validate(previewQuery, 'query'), getPreview);
router.post('/run', idempotent(), runNow);
router.get('/history', validate(reminderHistoryQuery, 'query'), getHistory);
router.get('/stats', validate(statsQuery, 'query'), getStats);
router.patch('/settings', validate(reminderSettingsSchema), patchSettings);

// Tests call the jobs as of a chosen moment. Never mounted outside NODE_ENV=test.
if (process.env.NODE_ENV === 'test') {
  router.post('/test/run', validate(testRunSchema), testRun);
}

export default router;
