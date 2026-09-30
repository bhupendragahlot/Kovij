import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { idParam } from '../../validators/common.js';
import { inboxQuery, preferencesSchema, pushSubscribeSchema, pushUnsubscribeSchema } from '../../validators/engagement.schema.js';
import {
  inbox,
  preferences,
  pushKey,
  pushSubscribe,
  pushUnsubscribe,
  readAll,
  readOne,
  savePreferences,
  unread,
} from '../../controllers/notificationController.js';
// Registers the web push channel with notifyMember.
import '../../services/pushChannel.js';

/**
 * OWNER: reminders, notifications & announcements module. Mounted at /api/member/notifications.
 * The member's inbox, notification preferences and web push subscriptions.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/', validate(inboxQuery, 'query'), inbox);
router.get('/unread-count', unread);
router.post('/read-all', readAll);
router.get('/preferences', preferences);
router.patch('/preferences', validate(preferencesSchema), savePreferences);
router.get('/push/key', pushKey);
router.post('/push/subscribe', validate(pushSubscribeSchema), pushSubscribe);
router.post('/push/unsubscribe', validate(pushUnsubscribeSchema), pushUnsubscribe);
router.post('/:id/read', validate(idParam, 'params'), readOne);

export default router;
