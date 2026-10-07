import Product from '../models/Product.js';
import { crudController } from './crudFactory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { removeAvatar } from '../services/storageService.js';

/**
 * Shop products. The public website lists only products marked "show on website"; staff with
 * plans.manage see and manage all of them (Staff app → Products).
 */
const base = crudController(Product, { label: 'Product', plural: 'products', publicFilter: { showOnFrontend: true }, sort: { createdAt: -1 } });

const notFound = () => new AppError('Product not found', 404, 'NOT_FOUND');

/** One SKU per product: say so on the field instead of a generic duplicate error. */
async function saving(work) {
  try {
    return await work();
  } catch (e) {
    if (e?.code === 11000 && (e.keyPattern?.sku || e.keyValue?.sku)) {
      throw new AppError('Another product already uses this SKU', 409, 'DUPLICATE_SKU', { fields: { sku: 'Another product already uses this SKU' } });
    }
    throw e;
  }
}

export const products = {
  listPublic: base.listPublic,
  getPublic: base.getPublic,

  /** GET /api/products/manage: every product, including hidden ones (staff). */
  list: base.list,

  create: asyncHandler(async (req, res) => {
    const doc = await saving(() => Product.create(req.validated.body));
    res.status(201).json(doc);
  }),

  update: asyncHandler(async (req, res) => {
    const before = await Product.findById(req.params.id).select('image').lean();
    if (!before) throw notFound();
    const doc = await saving(() => Product.findByIdAndUpdate(req.params.id, { $set: req.validated.body }, { new: true, runValidators: true }));
    if (req.validated.body.image && before.image !== doc.image) await removeAvatar(before.image);
    res.json(doc);
  }),

  remove: asyncHandler(async (req, res) => {
    const doc = await Product.findById(req.params.id);
    if (!doc) throw notFound();
    await doc.deleteOne();
    await removeAvatar(doc.image);
    res.json({ success: true, message: 'Product deleted' });
  }),

  /** POST /api/products/image (multipart `photo`): stores a product photo, answers with its URL. */
  uploadImage: asyncHandler(async (req, res) => {
    res.status(201).json({ success: true, url: req.avatarUrl });
  }),
};
