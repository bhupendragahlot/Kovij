import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
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
  listMeasurements,
  listProgressPhotos,
  streamProgressPhoto,
  updateMeasurement,
  uploadProgressPhoto,
} from '../../controllers/progressController.js';
import { loadSelf } from '../../controllers/wellnessAccess.js';
import { receivePhoto } from '../../services/progressPhotoService.js';

/**
 * OWNER: wellness module (diet, progress & notes). Mounted at /api/member/progress.
 * The signed-in member's own measurements and photos. Members may edit or delete only entries
 * they recorded themselves; photos of them can always be deleted by them.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth, loadSelf);

router.get('/', validate(listEntriesQuery, 'query'), getProgress);
router.get('/measurements', validate(listEntriesQuery, 'query'), listMeasurements);
router.post('/measurements', validate(measurementSchema), idempotent(), addMeasurement);
router.patch('/measurements/:entryId', validate(entryParams, 'params'), validate(measurementPatchSchema), updateMeasurement);
router.delete('/measurements/:entryId', validate(entryParams, 'params'), deleteMeasurement);

router.get('/photos', listProgressPhotos);
router.post('/photos', receivePhoto, validate(photoFieldsSchema), uploadProgressPhoto);
router.get('/photos/:photoId/file', validate(photoParams, 'params'), streamProgressPhoto);
router.delete('/photos/:photoId', validate(photoParams, 'params'), deleteProgressPhoto);

export default router;
