import express from 'express';
import { adminAuth } from '../../middleware/adminAuth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idempotent } from '../../middleware/idempotency.js';
import { idParam } from '../../validators/common.js';
import { createExpenseSchema, exportExpensesQuery, listExpensesQuery, updateExpenseSchema } from '../../validators/expense.schema.js';
import { uploadBill } from '../../services/expenseBillStorage.js';
import { create, downloadBill, exportCsv, getOne, list, remove, removeBill, update, uploadBillHandler } from '../../controllers/expenseController.js';

/**
 * OWNER: payments, finance & expenses module. Mounted at /api/admin/expenses.
 * Every route needs `expenses.manage` (owner and managers).
 */
const router = express.Router({ mergeParams: true });
const byId = validate(idParam, 'params');
router.use(adminAuth, requirePermission('expenses.manage'));

router.get('/', validate(listExpensesQuery, 'query'), list);
router.get('/export.csv', validate(exportExpensesQuery, 'query'), exportCsv);
// A double tap must not record the same bill twice.
router.post('/', validate(createExpenseSchema), idempotent(), create);
router.get('/:id', byId, getOne);
router.patch('/:id', byId, validate(updateExpenseSchema), update);
router.delete('/:id', byId, remove);
router.put('/:id/bill', byId, uploadBill, uploadBillHandler);
router.delete('/:id/bill', byId, removeBill);
router.get('/:id/bill', byId, downloadBill);

export default router;
