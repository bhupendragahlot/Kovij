import express from 'express';
import { trainers } from '../controllers/trainerController.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';

/** Public trainer profiles for the website. Staff manage trainers at /api/admin/trainers. */
const router = express.Router();

router.get('/', trainers.listPublic);
router.get('/:id', validate(idParam, 'params'), trainers.getPublic);

export default router;
