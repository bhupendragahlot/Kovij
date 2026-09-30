import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Standard list/get/create/update/delete handlers for simple catalog resources
 * (plans, trainers, products). Bodies must already be validated (req.validated.body).
 *
 * Response shapes stay compatible with the public website:
 *   list → { success, length, [plural]: [...] }   get → the document itself
 *
 * @param {import('mongoose').Model} Model
 * @param {object} opts
 * @param {string} opts.label        Human label for messages, e.g. "Plan"
 * @param {string} opts.plural       Key for list responses, e.g. "plans"
 * @param {string} [opts.publicFields]  Projection for unauthenticated reads
 * @param {object} [opts.publicFilter]  Filter for unauthenticated reads
 * @param {object} [opts.sort]
 * @param {(doc) => Promise<void>} [opts.beforeDelete]  Throw an AppError to block deletion
 */
export function crudController(Model, { label, plural, publicFields, publicFilter = {}, sort = { createdAt: -1 }, beforeDelete }) {
  const notFound = () => new AppError(`${label} not found`, 404, 'NOT_FOUND');

  return {
    listPublic: asyncHandler(async (req, res) => {
      const query = Model.find(publicFilter).sort(sort).lean();
      if (publicFields) query.select(publicFields);
      const docs = await query;
      res.json({ success: true, length: docs.length, [plural]: docs });
    }),

    list: asyncHandler(async (req, res) => {
      const docs = await Model.find().sort(sort).lean();
      res.json({ success: true, length: docs.length, [plural]: docs });
    }),

    getPublic: asyncHandler(async (req, res) => {
      const query = Model.findOne({ _id: req.params.id, ...publicFilter }).lean();
      if (publicFields) query.select(publicFields);
      const doc = await query;
      if (!doc) throw notFound();
      res.json(doc);
    }),

    create: asyncHandler(async (req, res) => {
      const doc = await Model.create(req.validated.body);
      res.status(201).json(doc);
    }),

    update: asyncHandler(async (req, res) => {
      const doc = await Model.findByIdAndUpdate(req.params.id, { $set: req.validated.body }, { new: true, runValidators: true });
      if (!doc) throw notFound();
      res.json(doc);
    }),

    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw notFound();
      if (beforeDelete) await beforeDelete(doc);
      await doc.deleteOne();
      res.json({ success: true, message: `${label} deleted` });
    }),
  };
}
