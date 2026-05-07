import express from 'express';
import { listMembers, getMember, forceExpire, notifyMember } from '../controllers/adminMemberController.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

router.use(adminAuth);

router.get('/', listMembers);
router.get('/:id', getMember);
router.post('/:id/expire', forceExpire);
router.post('/:id/notify', notifyMember);

export default router;
