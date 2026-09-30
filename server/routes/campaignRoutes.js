import express from 'express';
import { createCampaign, listCampaigns, sendCampaign, testCampaign, previewAudience } from '../controllers/campaignController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requireManager } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { createCampaignSchema, testCampaignSchema } from '../validators/campaign.schema.js';
import { campaignLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(adminAuth, requireManager);

router.get('/', listCampaigns);
router.get('/audience/:filter', previewAudience);
router.post('/', campaignLimiter, validate(createCampaignSchema), createCampaign);
router.post('/:id/send', campaignLimiter, sendCampaign);
router.post('/:id/test', campaignLimiter, validate(testCampaignSchema), testCampaign);

export default router;
