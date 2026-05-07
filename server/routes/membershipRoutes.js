import express from 'express';
import {
  join,
  getMine,
  getByMemberId,
  updatePlan,
  cancel,
  history,
} from '../controllers/membershipController.js';
import { memberAuth } from '../middleware/memberAuth.js';
import { staffOrOwnMember } from '../middleware/dualAuth.js';
import { validate } from '../middleware/validate.js';
import { joinMembershipSchema, updateMembershipSchema } from '../validators/membership.schema.js';

const router = express.Router();

router.get('/me', memberAuth, getMine);
router.post('/join', memberAuth, validate(joinMembershipSchema), join);
router.post('/update', memberAuth, validate(updateMembershipSchema), updatePlan);
router.post('/cancel', memberAuth, cancel);
router.get('/history/me', memberAuth, history);
router.get('/:userId', staffOrOwnMember, getByMemberId);

export default router;
