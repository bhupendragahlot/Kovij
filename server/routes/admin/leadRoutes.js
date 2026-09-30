import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParam } from '../../validators/common.js';
import { listLeadsQuery, createLeadSchema, updateLeadSchema, leadNoteSchema } from '../../validators/lead.schema.js';
import { listLeads, createLead, updateLead, addLeadNote, convertLead, retriageLead } from '../../controllers/leadController.js';

/** OWNER: leads (stable; no phase owner). Mounted at /api/admin/leads. */
const router = express.Router();
const byId = validate(idParam, 'params');
router.use(adminAuth, requirePermission('leads.manage'));

router.get('/', validate(listLeadsQuery, 'query'), listLeads);
router.post('/', validate(createLeadSchema), createLead);
router.patch('/:id', byId, validate(updateLeadSchema), updateLead);
router.post('/:id/notes', byId, validate(leadNoteSchema), addLeadNote);
router.post('/:id/convert', byId, convertLead);
router.post('/:id/triage', byId, retriageLead);

export default router;
