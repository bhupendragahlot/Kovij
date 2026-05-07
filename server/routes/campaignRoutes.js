import express from 'express';
import { createCampaign, listCampaigns, sendCampaign, testCampaign } from '../controllers/campaignController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { validate } from '../middleware/validate.js';
import { createCampaignSchema, testCampaignSchema } from '../validators/campaign.schema.js';
import { campaignLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(adminAuth);

router.post('/', campaignLimiter, validate(createCampaignSchema), createCampaign);
router.get('/', listCampaigns);
router.post('/:id/send', campaignLimiter, sendCampaign);
router.post('/:id/test', campaignLimiter, validate(testCampaignSchema, 'body'), testCampaign);

export default router;
