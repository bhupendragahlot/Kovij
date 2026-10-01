import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { memberHome } from '../../services/memberHomeService.js';

/** OWNER: member app core module. Mounted at /api/member/home. */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

/** GET /api/member/home — week strip, gym crowd now, latest weight, unread updates. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, ...(await memberHome(req.member.memberId)) });
  })
);

export default router;
