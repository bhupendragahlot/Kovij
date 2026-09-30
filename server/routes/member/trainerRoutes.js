import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { myTrainer } from '../../controllers/trainerController.js';

/**
 * OWNER: trainers, workouts & exercise library module. Mounted at /api/member/trainer.
 * The member's own assigned trainer, including phone and WhatsApp links (never another trainer's).
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/', myTrainer);

export default router;
