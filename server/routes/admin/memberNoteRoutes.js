import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { listNotesQuery, noteParams, notePatchSchema, noteSchema } from '../../validators/wellness.schema.js';
import { createNote, editNote, getNotes, removeNote } from '../../controllers/memberNoteController.js';
import { loadMemberParam } from '../../controllers/wellnessAccess.js';

/**
 * OWNER: wellness module (diet, progress & notes).
 * Mounted at /api/admin/members/:memberId/notes (req.params.memberId available).
 * Staff-only notes: no member route exposes them. Permission: notes.manage.
 */
const router = express.Router({ mergeParams: true });
router.use(adminAuth, requirePermission('notes.manage'), loadMemberParam);

router.get('/', validate(listNotesQuery, 'query'), getNotes);
router.post('/', validate(noteSchema), idempotent(), createNote);
router.patch('/:noteId', validate(noteParams, 'params'), validate(notePatchSchema), editNote);
router.delete('/:noteId', validate(noteParams, 'params'), removeNote);

export default router;
