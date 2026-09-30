import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import {
  announcementIdParam,
  audienceQuery,
  createAnnouncementSchema,
  listAnnouncementsQuery,
  updateAnnouncementSchema,
} from '../../validators/engagement.schema.js';
import { audience, create, getOne, list, publish, remove, unpublish, update } from '../../controllers/announcementController.js';

/**
 * OWNER: reminders, notifications & announcements module. Mounted at /api/admin/announcements.
 * Publishing notifies every member in the audience, so it requires an Idempotency-Key.
 */
const router = express.Router({ mergeParams: true });
const byId = validate(announcementIdParam, 'params');
router.use(adminAuth, requirePermission('announcements.manage'));

router.get('/', validate(listAnnouncementsQuery, 'query'), list);
router.get('/audience', validate(audienceQuery, 'query'), audience);
router.post('/', validate(createAnnouncementSchema), create);
router.get('/:id', byId, getOne);
router.patch('/:id', byId, validate(updateAnnouncementSchema), update);
router.post('/:id/publish', byId, idempotent(), publish);
router.post('/:id/unpublish', byId, unpublish);
router.delete('/:id', byId, remove);

export default router;
