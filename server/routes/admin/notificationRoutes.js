import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { memberIdParam, memberMessageSchema, notificationLogQuery } from '../../validators/engagement.schema.js';
import { forMember, log, sendMessage } from '../../controllers/notificationController.js';

/**
 * OWNER: reminders, notifications & announcements module. Mounted at /api/admin/notifications.
 *   GET  /                   log of everything sent to members (reminders.manage)
 *   GET  /members/:memberId  channels and recent messages for one member (communication.send)
 *   POST /messages           message one member (communication.send, Idempotency-Key)
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth);

router.get('/', requirePermission('reminders.manage'), validate(notificationLogQuery, 'query'), log);
router.get('/members/:memberId', requirePermission('communication.send'), validate(memberIdParam, 'params'), forMember);
router.post('/messages', requirePermission('communication.send'), validate(memberMessageSchema), idempotent(), sendMessage);

export default router;
