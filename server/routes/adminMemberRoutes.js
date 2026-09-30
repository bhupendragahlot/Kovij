import express from 'express';
import {
  listMembers,
  checkDuplicates,
  getMember,
  createMember,
  updateMember,
  sellPlan,
  cancelMembership,
  notifyMember,
  getIdProof,
} from '../controllers/adminMemberController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requireManager } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idempotent } from '../middleware/idempotency.js';
import { idParam } from '../validators/common.js';
import {
  listMembersQuery,
  duplicateCheckQuery,
  createMemberSchema,
  updateMemberSchema,
  saleSchema,
  notifyMemberSchema,
} from '../validators/member.schema.js';

const router = express.Router();
const byId = validate(idParam, 'params');

router.use(adminAuth);

router.get('/', validate(listMembersQuery, 'query'), listMembers);
router.get('/duplicates', validate(duplicateCheckQuery, 'query'), checkDuplicates);
router.post('/', validate(createMemberSchema), idempotent(), createMember);
router.get('/:id', byId, getMember);
router.patch('/:id', byId, validate(updateMemberSchema), updateMember);
router.post('/:id/memberships', byId, validate(saleSchema), idempotent(), sellPlan);
router.post('/:id/memberships/:membershipId/cancel', byId, requireManager, cancelMembership);
router.post('/:id/notify', byId, validate(notifyMemberSchema), notifyMember);
router.get('/:id/id-proof', byId, getIdProof);

export default router;
