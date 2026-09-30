import express from 'express';
import { memberAuth } from '../../middleware/memberAuth.js';
import { validate } from '../../middleware/validate.js';
import { historyQuery, monthQuery } from '../../validators/attendance.schema.js';
import { myHistory, myMonth, myQr, myStreak, myToday } from '../../controllers/attendanceController.js';

/**
 * OWNER: attendance & QR module. Mounted at /api/member/attendance (member app).
 * Members only ever see their own visits, without staff names or desk notes.
 */
const router = express.Router({ mergeParams: true });
router.use(memberAuth);

router.get('/today', myToday);
router.get('/history', validate(historyQuery, 'query'), myHistory);
router.get('/month', validate(monthQuery, 'query'), myMonth);
router.get('/streak', myStreak);
router.get('/qr', myQr);

export default router;
