import express from 'express';
import { getSettings, upsertSettings, deleteSettings } from '../controllers/settingsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js'; 
const router = express.Router();

router.get('/', getSettings);
router.post('/',protect, upsertSettings);   // Create or update
router.put('/', protect,upsertSettings);    // Update
router.delete('/',protect, deleteSettings); // Delete

export default router;