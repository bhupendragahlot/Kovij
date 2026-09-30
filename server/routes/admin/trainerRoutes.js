import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { AppError } from '../../middleware/errorHandler.js';
import { idParam } from '../../validators/common.js';
import { uploadMemberFiles } from '../../services/storageService.js';
import {
  assignMembersSchema,
  trainerMemberParams,
  trainerMembersQuery,
  trainerPatchSchema,
  trainerSchema,
} from '../../validators/trainer.schema.js';
import {
  assignTrainerMembers,
  createStaffTrainer,
  deleteStaffTrainer,
  getStaffTrainer,
  listStaffTrainers,
  listTrainerLogins,
  listTrainerMembers,
  myTrainerProfile,
  performance,
  unassignTrainerMember,
  updateStaffTrainer,
  uploadTrainerPhoto,
} from '../../controllers/trainerController.js';

/** OWNER: trainers, workouts & exercise library module. Mounted at /api/admin/trainers. */
const router = express.Router();
const byId = validate(idParam, 'params');
const view = requirePermission('members.view');
const manage = requirePermission('trainers.manage');

/** One public photo (JPEG, PNG, WebP or GIF, up to 5 MB) in the "photo" field. */
function photoUpload(req, res, next) {
  uploadMemberFiles.single('photo')(req, res, (err) => {
    if (!err || err.code === 'LIMIT_FILE_SIZE') return next(err);
    const message = err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Send one photo in the "photo" field' : err.message;
    next(new AppError(message, 422, 'VALIDATION_ERROR', { fields: { photo: message } }));
  });
}

router.use(adminAuth);

router.get('/', view, listStaffTrainers);
router.get('/me', view, myTrainerProfile);
router.get('/logins', manage, listTrainerLogins);
router.get('/performance', manage, performance);
router.post('/', manage, validate(trainerSchema), idempotent({ required: false }), createStaffTrainer);
router.get('/:id', byId, view, getStaffTrainer);
router.patch('/:id', byId, manage, validate(trainerPatchSchema), updateStaffTrainer);
router.delete('/:id', byId, manage, deleteStaffTrainer);
router.post('/:id/photo', byId, manage, photoUpload, uploadTrainerPhoto);
router.get('/:id/members', byId, view, validate(trainerMembersQuery, 'query'), listTrainerMembers);
router.post('/:id/members', byId, manage, validate(assignMembersSchema), assignTrainerMembers);
router.delete('/:id/members/:memberId', validate(trainerMemberParams, 'params'), manage, unassignTrainerMember);

export default router;
