import express from 'express';
import {
  changePassword,
  checkResetLink,
  forgotPassword,
  login,
  me,
  mySignIns,
  resetPassword,
  testResetToken,
} from '../controllers/authController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { validate } from '../middleware/validate.js';
import { staffLoginLimiter } from '../middleware/rateLimiter.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  resetTokenQuery,
} from '../validators/staff.schema.js';

const router = express.Router();

// Public self-registration was removed: staff accounts are created by an admin (POST /api/admin/staff)
// or bootstrapped with `npm run create-admin`.
router.post('/login', staffLoginLimiter, validate(loginSchema), login);
router.get('/me', adminAuth, me);

router.post('/forgot-password', staffLoginLimiter, validate(forgotPasswordSchema), forgotPassword);
router.get('/reset-password', staffLoginLimiter, validate(resetTokenQuery, 'query'), checkResetLink);
router.post('/reset-password', staffLoginLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/change-password', adminAuth, staffLoginLimiter, validate(changePasswordSchema), changePassword);
router.get('/sign-ins', adminAuth, mySignIns);

if (process.env.NODE_ENV === 'test') router.get('/_test/reset-token', testResetToken);

export default router;
