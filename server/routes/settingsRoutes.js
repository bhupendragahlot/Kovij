import express from 'express';
import { getPublicSettings } from '../controllers/settingsController.js';

/** Public website content. Staff edit settings at /api/admin/settings. */
const router = express.Router();

router.get('/', getPublicSettings);

export default router;
