import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { settingsSchema } from '../../validators/settings.schema.js';
import { getSettings, updateSettings, uploadLogo, removeLogo } from '../../controllers/settingsController.js';
import { avatarUpload } from '../../services/storageService.js';

/** OWNER: security, staff & settings module. Mounted at /api/admin/settings. */
const router = express.Router();
router.use(adminAuth);

router.get('/', getSettings);
router.patch('/', requirePermission('settings.manage'), validate(settingsSchema), updateSettings);
router.post('/logo', requirePermission('settings.manage'), avatarUpload, uploadLogo);
router.delete('/logo', requirePermission('settings.manage'), removeLogo);

export default router;
