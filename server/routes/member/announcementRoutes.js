import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { announcementIdParam } from '../../validators/engagement.schema.js';
import { memberGetOne, memberList } from '../../controllers/announcementController.js';

/**
 * OWNER: reminders, notifications & announcements module. Mounted at /api/member/announcements.
 * Live announcements for the signed-in member's audience, pinned first.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/', memberList);
router.get('/:id', validate(announcementIdParam, 'params'), memberGetOne);

export default router;
