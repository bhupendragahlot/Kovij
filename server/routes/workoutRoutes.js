import express from 'express';
import { memberAuth } from '../middleware/memberAuth.js';
import { validate } from '../middleware/validate.js';
import { createWorkoutSchema } from '../validators/workout.schema.js';
import { createMine, listMine } from '../controllers/workoutController.js';

const router = express.Router();

router.post('/', memberAuth, validate(createWorkoutSchema), createMine);
router.get('/me', memberAuth, listMine);

export default router;
