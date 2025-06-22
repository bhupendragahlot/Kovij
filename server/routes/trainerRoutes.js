// src/routes/trainerRoutes.js
import express from 'express';
import {
  getTrainers,
  getTrainerById,
  createTrainer,
  updateTrainer,
  deleteTrainer,
} from '../controllers/trainerController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js'; 
const router = express.Router();

router.get('/', getTrainers);
router.get('/:id',  getTrainerById);
router.post('/', protect, createTrainer);
router.put('/:id',protect,  updateTrainer);
router.delete('/:id',protect, deleteTrainer);

export default router;
