import { asyncHandler } from '../utils/asyncHandler.js';
import { addNote, deleteNote, listNotes, updateNote } from '../services/memberNoteService.js';
import { NOTE_MODERATOR_ROLES, canSeeHealth } from './wellnessAccess.js';

/** Staff notes on a member (/api/admin/members/:memberId/notes). Never reachable by members. */

const ctx = (req) => ({
  memberId: req.subject.memberId,
  staff: { id: req.staffUser.id, name: req.staffUser.name, role: req.staffUser.role },
  canSeeHealth: canSeeHealth(req),
  canModerate: NOTE_MODERATOR_ROLES.includes(req.staffUser.role),
});

/** GET ?category=&page=&limit= — pinned first, then newest. */
export const getNotes = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listNotes({ ...ctx(req), ...req.validated.query })) });
});

/** POST { text, category, pinned } — idempotent. */
export const createNote = asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, note: await addNote({ ...ctx(req), ...req.validated.body }) });
});

/** PATCH { text?, category?, pinned? } — text and category by the author only; anyone may pin. */
export const editNote = asyncHandler(async (req, res) => {
  res.json({ success: true, note: await updateNote({ ...ctx(req), noteId: req.validated.params.noteId, patch: req.validated.body }) });
});

/** DELETE — the author, or a manager. */
export const removeNote = asyncHandler(async (req, res) => {
  await deleteNote({ ...ctx(req), noteId: req.validated.params.noteId });
  res.json({ success: true });
});
