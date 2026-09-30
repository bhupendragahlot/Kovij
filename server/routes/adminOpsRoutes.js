import express from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { requireAdmin, requireManager } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { attendanceQuery, checkInSchema } from '../validators/member.schema.js';
import { listLeadsQuery, createLeadSchema, updateLeadSchema, leadNoteSchema } from '../validators/lead.schema.js';
import { createStaffSchema, updateStaffSchema } from '../validators/staff.schema.js';
import { settingsSchema, trainerSchema, trainerPatchSchema } from '../validators/catalog.schema.js';
import { getDashboard } from '../controllers/dashboardController.js';
import { listAttendance, checkIn, undoCheckIn } from '../controllers/attendanceController.js';
import { listLeads, createLead, updateLead, addLeadNote, convertLead, retriageLead } from '../controllers/leadController.js';
import { listStaff, createStaff, updateStaff } from '../controllers/staffController.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { trainers } from '../controllers/trainerController.js';

/** Staff-only operational endpoints mounted at /api/admin. */
const router = express.Router();
const byId = validate(idParam, 'params');

router.use(adminAuth);

router.get('/dashboard', getDashboard);

router.get('/attendance', validate(attendanceQuery, 'query'), listAttendance);
router.post('/attendance', validate(checkInSchema), checkIn);
router.delete('/attendance/:id', byId, undoCheckIn);

router.get('/leads', validate(listLeadsQuery, 'query'), listLeads);
router.post('/leads', validate(createLeadSchema), createLead);
router.patch('/leads/:id', byId, validate(updateLeadSchema), updateLead);
router.post('/leads/:id/notes', byId, validate(leadNoteSchema), addLeadNote);
router.post('/leads/:id/convert', byId, convertLead);
router.post('/leads/:id/triage', byId, retriageLead);

router.get('/trainers', trainers.list);
router.post('/trainers', requireManager, validate(trainerSchema), trainers.create);
router.patch('/trainers/:id', byId, requireManager, validate(trainerPatchSchema), trainers.update);
router.delete('/trainers/:id', byId, requireManager, trainers.remove);

router.get('/settings', getSettings);
router.patch('/settings', requireAdmin, validate(settingsSchema), updateSettings);

router.get('/staff', requireAdmin, listStaff);
router.post('/staff', requireAdmin, validate(createStaffSchema), createStaff);
router.patch('/staff/:id', byId, requireAdmin, validate(updateStaffSchema), updateStaff);

export default router;
