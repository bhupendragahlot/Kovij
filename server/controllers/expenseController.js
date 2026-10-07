import Expense from '../models/Expense.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { toGymTime } from '../utils/time.js';
import { sendCsv, toCsv } from '../services/csvExport.js';
import { billKey, billRefFor, removeBillFile } from '../services/expenseBillStorage.js';
import { fileExists, sendStoredFile } from '../services/fileStore.js';
import {
  buildExpenseFilter,
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  setExpenseBill,
  toClient,
  updateExpense,
} from '../services/expenseService.js';

const CATEGORY_LABELS = { rent: 'Rent', salary: 'Salary', electricity: 'Electricity', equipment: 'Equipment', maintenance: 'Maintenance', other: 'Other' };
const MODE_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank transfer or cheque' };

/** GET /api/admin/expenses */
export const list = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listExpenses(req.validated.query)) });
});

/** GET /api/admin/expenses/export.csv */
export const exportCsv = asyncHandler(async (req, res) => {
  const { month, category, q } = req.validated.query;
  const rows = await Expense.find(buildExpenseFilter({ month, category, q }))
    .sort({ spentOn: -1, createdAt: -1 })
    .limit(20_000)
    .populate('createdBy', 'name username')
    .lean();
  const csv = toCsv(
    [
      { header: 'Date', value: (e) => e.dayKey },
      { header: 'Category', value: (e) => CATEGORY_LABELS[e.category] || e.category },
      { header: 'Amount (INR)', value: (e) => e.amount },
      { header: 'Paid by', value: (e) => MODE_LABELS[e.mode] || e.mode },
      { header: 'Paid to', value: (e) => e.vendor },
      { header: 'Note', value: (e) => e.note },
      { header: 'Bill attached', value: (e) => (e.bill?.ref ? 'Yes' : 'No') },
      { header: 'Added by', value: (e) => e.createdBy?.name || e.createdBy?.username },
    ],
    rows
  );
  sendCsv(res, `expenses-${month || toGymTime().format('YYYY-MM-DD')}.csv`, csv);
});

/** GET /api/admin/expenses/:id */
export const getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, expense: toClient(await getExpense(req.params.id)) });
});

/** POST /api/admin/expenses (idempotent) */
export const create = asyncHandler(async (req, res) => {
  const existing = req.idempotencyKey ? await Expense.findOne({ idempotencyKey: req.idempotencyKey }).lean() : null;
  if (existing) return res.status(200).json({ success: true, replayed: true, expense: toClient(existing) });
  const expense = await createExpense(req.validated.body, { staffId: req.staffUser.id, idempotencyKey: req.idempotencyKey });
  res.status(201).json({ success: true, expense });
});

/** PATCH /api/admin/expenses/:id */
export const update = asyncHandler(async (req, res) => {
  res.json({ success: true, expense: await updateExpense(req.params.id, req.validated.body, { staffId: req.staffUser.id }) });
});

/** DELETE /api/admin/expenses/:id */
export const remove = asyncHandler(async (req, res) => {
  await deleteExpense(req.params.id, { staffId: req.staffUser.id });
  res.json({ success: true, message: 'Expense deleted' });
});

/** PUT /api/admin/expenses/:id/bill (multipart field "bill") */
export const uploadBillHandler = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Choose a photo or PDF of the bill', 422, 'VALIDATION_ERROR', { fields: { bill: 'Choose a file' } });
  try {
    const expense = await setExpenseBill(req.params.id, { ...req.file, ref: billRefFor(req.file) }, { staffId: req.staffUser.id });
    res.json({ success: true, expense });
  } catch (e) {
    removeBillFile(billRefFor(req.file));
    throw e;
  }
});

/** DELETE /api/admin/expenses/:id/bill */
export const removeBill = asyncHandler(async (req, res) => {
  res.json({ success: true, expense: await setExpenseBill(req.params.id, null, { staffId: req.staffUser.id }) });
});

/** GET /api/admin/expenses/:id/bill: streams the private file to staff only. */
export const downloadBill = asyncHandler(async (req, res) => {
  const expense = await getExpense(req.params.id);
  const key = billKey(expense.bill?.ref);
  if (!key || !(await fileExists(key))) throw new AppError('No bill is attached to this expense', 404, 'NOT_FOUND');
  const safeName = String(expense.bill.name || 'bill').replace(/[^A-Za-z0-9._ -]/g, '_');
  await sendStoredFile(res, key, { disposition: `inline; filename="${safeName}"` });
});
