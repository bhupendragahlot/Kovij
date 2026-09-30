import express from 'express';
import {
  listMembers,
  exportMembers,
  checkDuplicates,
  getMember,
  getTimeline,
  createMember,
  updateMember,
  uploadPhoto,
  removePhoto,
  sellPlan,
  cancelMembership,
  notifyMember,
  getIdProof,
} from '../controllers/adminMemberController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate } from '../middleware/validate.js';
import { idempotent } from '../middleware/idempotency.js';
import { idParam } from '../validators/common.js';
import { avatarUpload } from '../services/storageService.js';
import {
  listMembersQuery,
  exportMembersQuery,
  duplicateCheckQuery,
  createMemberSchema,
  updateMemberSchema,
  saleSchema,
  notifyMemberSchema,
  cancelMembershipSchema,
  membershipParams,
} from '../validators/member.schema.js';

/**
 * OWNER: members & membership lifecycle module. Mounted at /api/admin/members.
 * Trainers may read members (without money); only the desk edits, and selling needs memberships.sell.
 * Money fields (dues, payments, prices) and health data are also filtered per role in the controller.
 */
const router = express.Router();
const byId = validate(idParam, 'params');

router.use(adminAuth);

router.get('/', requirePermission('members.view'), validate(listMembersQuery, 'query'), listMembers);
router.get('/export.csv', requirePermission('members.view'), validate(exportMembersQuery, 'query'), exportMembers);
router.get('/duplicates', requirePermission('members.edit'), validate(duplicateCheckQuery, 'query'), checkDuplicates);
router.post('/', requirePermission('members.edit'), validate(createMemberSchema), idempotent(), createMember);
router.get('/:id', byId, requirePermission('members.view'), getMember);
router.get('/:id/timeline', byId, requirePermission('members.view'), getTimeline);
router.patch('/:id', byId, requirePermission('members.edit'), validate(updateMemberSchema), updateMember);
router.post('/:id/photo', byId, requirePermission('members.edit'), avatarUpload, uploadPhoto);
router.delete('/:id/photo', byId, requirePermission('members.edit'), removePhoto);
router.post('/:id/memberships', byId, requirePermission('memberships.sell'), validate(saleSchema), idempotent(), sellPlan);
router.post(
  '/:id/memberships/:membershipId/cancel',
  validate(membershipParams, 'params'),
  requirePermission('membership.cancel'),
  validate(cancelMembershipSchema),
  cancelMembership
);
router.post('/:id/notify', byId, requirePermission('communication.send'), validate(notifyMemberSchema), notifyMember);
// ID documents are for the desk (verification), not coaching.
router.get('/:id/id-proof', byId, requirePermission('members.edit'), getIdProof);

export default router;
