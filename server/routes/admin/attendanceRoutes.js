import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import {
  attendanceQuery,
  checkInSchema,
  checkOutSchema,
  exportQuery,
  historyQuery,
  memberParam,
  monthMembersQuery,
  monthQuery,
  reissueQrSchema,
  scanSchema,
} from '../../validators/attendance.schema.js';
import {
  checkIn,
  checkOut,
  exportCsv,
  listAttendance,
  memberHistory,
  memberMonth,
  memberQr,
  memberSummary,
  monthMembers,
  monthView,
  reissueQr,
  scan,
  undoCheckIn,
  undoCheckOut,
} from '../../controllers/attendanceController.js';

/**
 * OWNER: attendance & QR module. Mounted at /api/admin/attendance.
 * Reads need attendance.view (trainers too); every write needs attendance.checkin (front desk and
 * up). Bulk export is a report, so it needs reports.view.
 */
const router = express.Router();
router.use(adminAuth);

const view = requirePermission('attendance.view');
const desk = requirePermission('attendance.checkin');

// Day and month
router.get('/', view, validate(attendanceQuery, 'query'), listAttendance);
router.get('/month', view, validate(monthQuery, 'query'), monthView);
router.get('/month/members', view, validate(monthMembersQuery, 'query'), monthMembers);
router.get('/export', requirePermission('reports.view'), validate(exportQuery, 'query'), exportCsv);

// Check-in, scans, check-out, undo. Check-in dedupes by day on its own, so its key is optional
// (older desk clients send none); a scan toggles in/out, so a retry must replay, not repeat.
router.post('/', desk, validate(checkInSchema), idempotent({ required: false }), checkIn);
router.post('/scan', desk, validate(scanSchema), idempotent(), scan);
router.post('/:id/check-out', desk, validate(idParam, 'params'), validate(checkOutSchema), idempotent(), checkOut);
router.delete('/:id/check-out', desk, validate(idParam, 'params'), undoCheckOut);
router.delete('/:id', desk, validate(idParam, 'params'), undoCheckIn);

// One member
router.get('/members/:memberId/summary', view, validate(memberParam, 'params'), memberSummary);
router.get('/members/:memberId/month', view, validate(memberParam, 'params'), validate(monthQuery, 'query'), memberMonth);
router.get('/members/:memberId/history', view, validate(memberParam, 'params'), validate(historyQuery, 'query'), memberHistory);
router.get('/members/:memberId/qr', desk, validate(memberParam, 'params'), memberQr);
router.post('/members/:memberId/qr/reissue', desk, validate(memberParam, 'params'), validate(reissueQrSchema), idempotent(), reissueQr);

export default router;
