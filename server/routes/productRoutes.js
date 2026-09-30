import express from 'express';
import { products } from '../controllers/productController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requireManager } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { productSchema, productPatchSchema } from '../validators/catalog.schema.js';

const router = express.Router();
const byId = validate(idParam, 'params');

router.get('/', products.listPublic);
router.get('/:id', byId, products.getPublic);
router.post('/', adminAuth, requireManager, validate(productSchema), products.create);
router.put('/:id', byId, adminAuth, requireManager, validate(productPatchSchema), products.update);
router.delete('/:id', byId, adminAuth, requireManager, products.remove);

export default router;
