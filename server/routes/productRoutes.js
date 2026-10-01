import express from 'express';
import { products } from '../controllers/productController.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { productSchema, productPatchSchema } from '../validators/catalog.schema.js';

const router = express.Router();
const byId = validate(idParam, 'params');
// Shop products are part of the catalogue managers look after, like plans.
const manage = requirePermission('plans.manage');

router.get('/', products.listPublic);
router.get('/:id', byId, products.getPublic);
router.post('/', adminAuth, manage, validate(productSchema), products.create);
router.put('/:id', byId, adminAuth, manage, validate(productPatchSchema), products.update);
router.delete('/:id', byId, adminAuth, manage, products.remove);

export default router;
