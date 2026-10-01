import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import { staffListQuery, staffReplySchema, staffUpdateSchema } from '../../validators/support.schema.js';
import { inbox, inboxTicket, replyFromDesk, updateFromDesk } from '../../controllers/supportController.js';

/** OWNER: member app content & support module. Mounted at /api/admin/support. */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('support.manage'));
const byId = validate(idParam, 'params');

router.get('/', validate(staffListQuery, 'query'), inbox);
router.get('/:id', byId, inboxTicket);
// Each reply emails the member: a retried request must not send it twice.
router.post('/:id/messages', byId, validate(staffReplySchema), idempotent({ required: false }), replyFromDesk);
router.patch('/:id', byId, validate(staffUpdateSchema), updateFromDesk);

export default router;
