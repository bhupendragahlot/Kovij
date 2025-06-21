import express from 'express';
import { getSettings, upsertSettings, deleteSettings } from '../controllers/settingsController.js';

const router = express.Router();

router.get('/', getSettings);
router.post('/', upsertSettings);   // Create or update
router.put('/', upsertSettings);    // Update
router.delete('/', deleteSettings); // Delete

export default router;