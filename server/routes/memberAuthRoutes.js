import express from 'express';
import { googleLogin, me } from '../controllers/memberAuthController.js';
import { uploadMemberDocs } from '../controllers/memberUploadController.js';
import { getMyProfile, updateMyProfile } from '../controllers/memberProfileController.js';
import { memberAuth } from '../middleware/memberAuth.js';
import { validate } from '../middleware/validate.js';
import { googleAuthSchema } from '../validators/auth.schema.js';
import { updateMemberProfileSchema } from '../validators/memberProfile.schema.js';
import { authGoogleLimiter } from '../middleware/rateLimiter.js';
import { uploadMemberFiles } from '../services/storageService.js';

const router = express.Router();

router.post('/google', authGoogleLimiter, validate(googleAuthSchema), googleLogin);
router.get('/me', memberAuth, me);
router.get('/profile', memberAuth, getMyProfile);
router.patch('/profile', memberAuth, validate(updateMemberProfileSchema), updateMyProfile);
router.post(
  '/uploads',
  memberAuth,
  uploadMemberFiles.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'idProof', maxCount: 1 },
  ]),
  uploadMemberDocs
);

export default router;
