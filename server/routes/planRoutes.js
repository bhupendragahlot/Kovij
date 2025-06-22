// src/routes/planRoutes.js
import express from 'express';
import {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from '../controllers/planController.js';
import { protect } from '../middleware/authMiddleware.js';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

router.get('/',cacheMiddleware,  getPlans);
router.get('/:id', getPlanById);
router.post('/', protect, createPlan);
router.put('/:id', protect, updatePlan);
router.delete('/:id',protect,deletePlan);

export default router;
