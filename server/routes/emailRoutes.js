import express from 'express';
import { sendEmail } from '../controllers/emailController.js';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimiter.js';
import { contactSchema } from '../validators/catalog.schema.js';

const router = express.Router();

// Website contact form. Never cache a POST: every submission must reach the handler.
router.post('/send-email', contactLimiter, validate(contactSchema), sendEmail);

export default router;
