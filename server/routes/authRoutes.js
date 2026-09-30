import express from 'express';
import { login, me } from '../controllers/authController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { validate } from '../middleware/validate.js';
import { staffLoginLimiter } from '../middleware/rateLimiter.js';
import { loginSchema } from '../validators/staff.schema.js';

const router = express.Router();

// Public self-registration was removed: staff accounts are created by an admin (POST /api/admin/staff)
// or bootstrapped with `npm run create-admin`.
router.post('/login', staffLoginLimiter, validate(loginSchema), login);
router.get('/me', adminAuth, me);

export default router;
