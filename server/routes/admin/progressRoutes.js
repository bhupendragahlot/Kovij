import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import {
  entryParams,
  listEntriesQuery,
  measurementPatchSchema,
  measurementSchema,
  photoFieldsSchema,
  photoParams,
} from '../../validators/wellness.schema.js';
import {
  addMeasurement,
  deleteMeasurement,
  deleteProgressPhoto,
  getProgress,
  listProgressPhotos,
  streamProgressPhoto,
  updateMeasurement,
  uploadProgressPhoto,
} from '../../controllers/progressController.js';
import { loadMemberParam } from '../../controllers/wellnessAccess.js';
import { receivePhoto } from '../../services/progressPhotoService.js';

/**
 * OWNER: wellness module (diet, progress & notes).
 * Mounted at /api/admin/members/:memberId/progress (req.params.memberId available).
 *
 * Measurements and photos are health data: reading them needs members.health.view; recording
 * needs progress.manage (and health.view too, because the response carries the data).
 */
const router = express.Router({ mergeParams: true });
const view = requirePermission('members.health.view');
const manage = requirePermission('progress.manage');
router.use(adminAuth);

router.get('/', view, loadMemberParam, validate(listEntriesQuery, 'query'), getProgress);
router.post('/entries', manage, view, loadMemberParam, validate(measurementSchema), idempotent(), addMeasurement);
router.patch('/entries/:entryId', manage, view, loadMemberParam, validate(entryParams, 'params'), validate(measurementPatchSchema), updateMeasurement);
router.delete('/entries/:entryId', manage, loadMemberParam, validate(entryParams, 'params'), deleteMeasurement);

router.get('/photos', view, loadMemberParam, listProgressPhotos);
// Replaces the photo for the same day and pose, so a retried upload can't create a duplicate.
router.post('/photos', manage, view, loadMemberParam, receivePhoto, validate(photoFieldsSchema), uploadProgressPhoto);
router.get('/photos/:photoId/file', view, loadMemberParam, validate(photoParams, 'params'), streamProgressPhoto);
router.delete('/photos/:photoId', manage, loadMemberParam, validate(photoParams, 'params'), deleteProgressPhoto);

export default router;
