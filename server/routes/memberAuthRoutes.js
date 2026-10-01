import express from 'express';
import { authConfig, createSession, me, requestTestOtp, verifyTestOtp } from '../controllers/memberAuthController.js';
import { uploadMemberDocs } from '../controllers/memberUploadController.js';
import { getMyProfile, updateMyProfile } from '../controllers/memberProfileController.js';
import { memberAuth } from '../middleware/memberAuth.js';
import { validate } from '../middleware/validate.js';
import { memberSessionSchema, otpRequestSchema, otpVerifySchema } from '../validators/auth.schema.js';
import { updateMemberProfileSchema } from '../validators/memberProfile.schema.js';
import { authGoogleLimiter } from '../middleware/rateLimiter.js';
import { uploadMemberFiles } from '../services/storageService.js';
import { reportTestOtpMode } from '../services/testOtp.js';

const router = express.Router();
reportTestOtpMode();

router.get('/config', authConfig);
router.post('/session', authGoogleLimiter, validate(memberSessionSchema), createSession);
// Test-mode mobile sign-in (DEFAULT_OTP): no SMS, a fixed code. Refused in production.
router.post('/otp/request', authGoogleLimiter, validate(otpRequestSchema), requestTestOtp);
router.post('/otp/verify', authGoogleLimiter, validate(otpVerifySchema), verifyTestOtp);
// Older app builds still post Google sign-ins here.
router.post('/google', authGoogleLimiter, validate(memberSessionSchema), createSession);
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
