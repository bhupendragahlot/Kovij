import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import { createTicketSchema, replySchema } from '../../validators/support.schema.js';
import { myTicket, myTickets, openTicket, replyToMine, resolveMine } from '../../controllers/supportController.js';

/** OWNER: member app content & support module. Mounted at /api/member/support. */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);
const byId = validate(idParam, 'params');

router.get('/', myTickets);
// A double tap on "Send" creates one request (Idempotency-Key optional for older clients).
router.post('/', validate(createTicketSchema), idempotent({ required: false }), openTicket);
router.get('/:id', byId, myTicket);
router.post('/:id/messages', byId, validate(replySchema), idempotent({ required: false }), replyToMine);
router.post('/:id/resolve', byId, resolveMine);

export default router;
