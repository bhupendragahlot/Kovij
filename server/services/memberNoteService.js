/**
 * Staff notes on a member: a timeline with pinned notes first. Staff only, never returned by a
 * member route. Authors edit their own notes; anyone with notes.manage can pin; managers can
 * delete any note. "Health" notes are left out for roles that can't see health data.
 */
import MemberNote, { NOTE_CATEGORIES } from '../models/MemberNote.js';
import { AppError } from '../middleware/errorHandler.js';
import { toObjectId } from '../utils/db.js';

const presentNote = (n, staff, { canModerate }) => ({
  _id: n._id,
  text: n.text,
  category: n.category,
  pinned: Boolean(n.pinned),
  pinnedAt: n.pinnedAt || null,
  author: { _id: n.authorId, name: n.authorName || 'Staff', role: n.authorRole || '' },
  createdAt: n.createdAt,
  editedAt: n.editedAt || null,
  canEdit: String(n.authorId) === String(staff.id),
  canDelete: String(n.authorId) === String(staff.id) || canModerate,
});

export async function listNotes({ memberId, category, page = 1, limit = 50, staff, canSeeHealth, canModerate }) {
  const visible = canSeeHealth ? {} : { category: { $ne: 'health' } };
  const filter = { memberId, ...visible };
  if (category) {
    if (category === 'health' && !canSeeHealth) return { notes: [], total: 0, page, limit, counts: {} };
    filter.category = category;
  }
  const [rows, total, counts] = await Promise.all([
    MemberNote.find(filter).sort({ pinned: -1, pinnedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    MemberNote.countDocuments(filter),
    MemberNote.aggregate([{ $match: { memberId: toObjectId(memberId), ...visible } }, { $group: { _id: '$category', n: { $sum: 1 } } }]),
  ]);
  const byCategory = Object.fromEntries(NOTE_CATEGORIES.filter((c) => canSeeHealth || c !== 'health').map((c) => [c, 0]));
  for (const c of counts) byCategory[c._id] = c.n;
  byCategory.all = Object.values(byCategory).reduce((a, b) => a + b, 0);
  return { notes: rows.map((n) => presentNote(n, staff, { canModerate })), total, page, limit, counts: byCategory };
}

export async function addNote({ memberId, text, category, pinned, staff, canSeeHealth, canModerate }) {
  if (category === 'health' && !canSeeHealth) throw new AppError('Your role cannot add health notes', 403, 'FORBIDDEN');
  const note = await MemberNote.create({
    memberId,
    text,
    category,
    pinned,
    pinnedAt: pinned ? new Date() : undefined,
    authorId: staff.id,
    authorName: staff.name,
    authorRole: staff.role,
  });
  return presentNote(note.toObject(), staff, { canModerate });
}

async function findNote(memberId, noteId, canSeeHealth) {
  const note = await MemberNote.findOne({ _id: noteId, memberId }).lean();
  if (!note || (note.category === 'health' && !canSeeHealth)) throw new AppError('Note not found', 404, 'NOT_FOUND');
  return note;
}

export async function updateNote({ memberId, noteId, patch, staff, canSeeHealth, canModerate }) {
  const note = await findNote(memberId, noteId, canSeeHealth);
  const isAuthor = String(note.authorId) === String(staff.id);
  const set = {};
  const unset = {};
  if (patch.text !== undefined || patch.category !== undefined) {
    if (!isAuthor) throw new AppError('Only the person who wrote this note can edit it', 403, 'FORBIDDEN');
    if (patch.category === 'health' && !canSeeHealth) throw new AppError('Your role cannot add health notes', 403, 'FORBIDDEN');
    const changed = (patch.text !== undefined && patch.text !== note.text) || (patch.category !== undefined && patch.category !== note.category);
    if (patch.text !== undefined) set.text = patch.text;
    if (patch.category !== undefined) set.category = patch.category;
    if (changed) set.editedAt = new Date();
  }
  if (patch.pinned !== undefined && patch.pinned !== Boolean(note.pinned)) {
    set.pinned = patch.pinned;
    if (patch.pinned) set.pinnedAt = new Date();
    else unset.pinnedAt = '';
  }
  if (!Object.keys(set).length && !Object.keys(unset).length) return presentNote(note, staff, { canModerate });
  const update = { $set: set, ...(Object.keys(unset).length && { $unset: unset }) };
  const saved = await MemberNote.findOneAndUpdate({ _id: note._id }, update, { new: true, runValidators: true }).lean();
  return presentNote(saved, staff, { canModerate });
}

export async function deleteNote({ memberId, noteId, staff, canSeeHealth, canModerate }) {
  const note = await findNote(memberId, noteId, canSeeHealth);
  if (String(note.authorId) !== String(staff.id) && !canModerate) {
    throw new AppError('Only the author or a manager can delete this note', 403, 'FORBIDDEN');
  }
  await MemberNote.deleteOne({ _id: note._id });
}
