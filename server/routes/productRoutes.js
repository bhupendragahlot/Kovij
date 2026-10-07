import express from 'express';
import { products } from '../controllers/productController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { productSchema, productPatchSchema } from '../validators/catalog.schema.js';
import { avatarUpload } from '../services/storageService.js';

/**
 * Mounted at /api/products. Public reads list only products shown on the website; staff manage
 * the catalogue (Staff app → Products), like plans.
 */
const router = express.Router();
const byId = validate(idParam, 'params');
const manage = requirePermission('plans.manage');

// Fixed paths before /:id.
router.get('/manage', adminAuth, manage, products.list);
router.post('/image', adminAuth, manage, avatarUpload, products.uploadImage);

router.get('/', products.listPublic);
router.get('/:id', byId, products.getPublic);
router.post('/', adminAuth, manage, validate(productSchema), products.create);
router.put('/:id', byId, adminAuth, manage, validate(productPatchSchema), products.update);
router.delete('/:id', byId, adminAuth, manage, products.remove);

export default router;
