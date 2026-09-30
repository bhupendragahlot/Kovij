import Trainer from '../models/Trainer.js';
import { crudController } from './crudFactory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { can } from '../config/permissions.js';
import { fileRefFor } from '../services/storageService.js';
import {
  assignMembers,
  coachingRoster,
  createTrainer,
  getTrainer,
  linkableLogins,
  listTrainers,
  removeTrainer,
  setTrainerPhoto,
  trainerForMember,
  trainerForUser,
  trainerPerformance,
  unassignMember,
  updateTrainer,
} from '../services/training/trainerService.js';

/** Public website reads. Phone, email, shift, schedule and the linked login are for staff only. */
export const trainers = crudController(Trainer, {
  label: 'Trainer',
  plural: 'trainers',
  sort: { createdAt: 1 },
  publicFields: 'name role image instagram description specialties showOnFrontend',
  publicFilter: { isActive: { $ne: false } },
});

/** GET /api/admin/trainers */
export const listStaffTrainers = asyncHandler(async (req, res) => {
  const items = await listTrainers();
  res.json({ success: true, length: items.length, trainers: items });
});

/** GET /api/admin/trainers/me — the trainer profile linked to the signed-in login, if any. */
export const myTrainerProfile = asyncHandler(async (req, res) => {
  res.json({ success: true, trainer: await trainerForUser(req.staffUser.id) });
});

/** GET /api/admin/trainers/logins — staff logins with the trainer role, for linking. */
export const listTrainerLogins = asyncHandler(async (req, res) => {
  res.json({ success: true, users: await linkableLogins() });
});

/** GET /api/admin/trainers/performance */
export const performance = asyncHandler(async (req, res) => {
  const list = await listTrainers();
  const rows = await trainerPerformance(list.map((t) => t._id));
  const byId = new Map(rows.map((r) => [r.trainerId, r]));
  res.json({
    success: true,
    items: list.map((t) => ({ trainer: { _id: t._id, name: t.name, image: t.image, isActive: t.isActive !== false }, ...byId.get(String(t._id)) })),
  });
});

/** GET /api/admin/trainers/:id — coaching numbers only for managers or the trainer themself. */
export const getStaffTrainer = asyncHandler(async (req, res) => {
  const trainer = await getTrainer(req.params.id);
  const own = trainer.userId && String(trainer.userId) === req.staffUser.id;
  const showNumbers = own || can(req.staffUser.role, 'trainers.manage');
  const [perf] = showNumbers ? await trainerPerformance([trainer._id]) : [null];
  res.json({ success: true, trainer, performance: perf });
});

/** POST /api/admin/trainers */
export const createStaffTrainer = asyncHandler(async (req, res) => {
  const trainer = await createTrainer(req.validated.body);
  res.status(201).json({ success: true, trainer });
});

/** PATCH /api/admin/trainers/:id */
export const updateStaffTrainer = asyncHandler(async (req, res) => {
  res.json({ success: true, trainer: await updateTrainer(req.params.id, req.validated.body) });
});

/** DELETE /api/admin/trainers/:id */
export const deleteStaffTrainer = asyncHandler(async (req, res) => {
  const { name } = await removeTrainer(req.params.id);
  res.json({ success: true, message: `${name} removed` });
});

/** POST /api/admin/trainers/:id/photo (multipart, field "photo"). Trainer photos are public. */
export const uploadTrainerPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Choose a photo to upload', 422, 'VALIDATION_ERROR', { fields: { photo: 'Choose a photo' } });
  res.json({ success: true, trainer: await setTrainerPhoto(req.params.id, fileRefFor(req.file)) });
});

/** GET /api/admin/trainers/:id/members */
export const listTrainerMembers = asyncHandler(async (req, res) => {
  const exists = await Trainer.exists({ _id: req.params.id });
  if (!exists) throw new AppError('Trainer not found', 404, 'NOT_FOUND');
  const { q, page, limit } = req.validated.query;
  const result = await coachingRoster({ trainerId: req.params.id, q, page, limit });
  res.json({ success: true, ...result });
});

/** POST /api/admin/trainers/:id/members — assign (or move) members to this trainer. */
export const assignTrainerMembers = asyncHandler(async (req, res) => {
  const result = await assignMembers(req.params.id, req.validated.body.memberIds);
  res.json({ success: true, ...result });
});

/** DELETE /api/admin/trainers/:id/members/:memberId */
export const unassignTrainerMember = asyncHandler(async (req, res) => {
  const result = await unassignMember(req.params.id, req.params.memberId);
  res.json({ success: true, ...result });
});

/** GET /api/member/trainer — the member's own trainer, with contact links. */
export const myTrainer = asyncHandler(async (req, res) => {
  res.json({ success: true, trainer: await trainerForMember(req.member.memberId) });
});
