import Expense from '../models/Expense.js';
import { AppError } from '../middleware/errorHandler.js';
import { escapeRegex } from '../utils/strings.js';
import { parseGymDay } from '../utils/time.js';
import { monthRange } from './financeService.js';
import { roundMoney } from './paymentService.js';
import { removeBillFile } from './expenseBillStorage.js';

const ALIVE = { deletedAt: null };

/** Filter for the expense list and export. Pure. */
export function buildExpenseFilter({ month, category, q } = {}) {
  const filter = { ...ALIVE };
  if (month) {
    const range = monthRange(month);
    filter.spentOn = { $gte: range.from, $lt: range.to };
  }
  if (category) filter.category = category;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ vendor: rx }, { note: rx }];
  }
  return filter;
}

/** Stored fields for a `YYYY-MM-DD` day (gym time). */
export const dayFields = (dayKey) => ({ dayKey, spentOn: parseGymDay(dayKey).startOf('day').toDate() });

export async function listExpenses({ month, category, q, page = 1, limit = 25 }) {
  const filter = buildExpenseFilter({ month, category, q });
  // Category totals ignore the category filter so every chip can show its amount.
  const totalsFilter = buildExpenseFilter({ month, q });
  const [items, total, byCategory] = await Promise.all([
    Expense.find(filter)
      .sort({ spentOn: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name username')
      .lean(),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: totalsFilter }, { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
  ]);
  const categories = Object.fromEntries(byCategory.map((r) => [r._id, { amount: roundMoney(r.amount), count: r.count }]));
  const shown = category ? [categories[category] || { amount: 0, count: 0 }] : Object.values(categories);
  return {
    items: items.map(toClient),
    total,
    page,
    limit,
    totals: {
      amount: roundMoney(shown.reduce((s, c) => s + c.amount, 0)),
      count: shown.reduce((s, c) => s + c.count, 0),
      byCategory: categories,
    },
  };
}

export async function getExpense(id) {
  const expense = await Expense.findOne({ _id: id, ...ALIVE }).populate('createdBy', 'name username').lean();
  if (!expense) throw new AppError('Expense not found', 404, 'NOT_FOUND');
  return expense;
}

export async function createExpense(data, { staffId, idempotencyKey }) {
  const [expense] = await Expense.create([
    {
      category: data.category,
      amount: roundMoney(data.amount),
      ...dayFields(data.date),
      mode: data.mode,
      vendor: data.vendor || '',
      note: data.note || '',
      createdBy: staffId,
      idempotencyKey,
    },
  ]);
  return toClient(expense.toObject());
}

export async function updateExpense(id, patch, { staffId }) {
  const set = { updatedBy: staffId };
  for (const k of ['category', 'mode', 'vendor', 'note']) if (patch[k] !== undefined) set[k] = patch[k] ?? '';
  if (patch.amount !== undefined) set.amount = roundMoney(patch.amount);
  if (patch.date) Object.assign(set, dayFields(patch.date));
  const expense = await Expense.findOneAndUpdate({ _id: id, ...ALIVE }, { $set: set }, { new: true, runValidators: true }).lean();
  if (!expense) throw new AppError('Expense not found', 404, 'NOT_FOUND');
  return toClient(expense);
}

/** Hidden, not erased: the books keep who deleted what and when. */
export async function deleteExpense(id, { staffId }) {
  const expense = await Expense.findOneAndUpdate({ _id: id, ...ALIVE }, { $set: { deletedAt: new Date(), deletedBy: staffId } }, { new: true }).lean();
  if (!expense) throw new AppError('Expense not found', 404, 'NOT_FOUND');
  return toClient(expense);
}

export async function setExpenseBill(id, file, { staffId }) {
  const bill = file
    ? { ref: file.ref, name: String(file.originalname || 'bill').slice(0, 120), mime: file.mimetype, size: file.size, uploadedAt: new Date() }
    : null;
  const before = await Expense.findOneAndUpdate(
    { _id: id, ...ALIVE },
    bill ? { $set: { bill, updatedBy: staffId } } : { $unset: { bill: 1 }, $set: { updatedBy: staffId } },
    { new: false }
  ).lean();
  if (!before) {
    if (file) removeBillFile(file.ref);
    throw new AppError('Expense not found', 404, 'NOT_FOUND');
  }
  if (before.bill?.ref) removeBillFile(before.bill.ref);
  return getExpense(id).then(toClient);
}

/** API shape: the private file reference never leaves the server. */
export function toClient(e) {
  if (!e) return e;
  const { bill, idempotencyKey, deletedBy, ...rest } = e;
  return {
    ...rest,
    date: e.dayKey,
    bill: bill?.ref ? { name: bill.name, mime: bill.mime, size: bill.size, uploadedAt: bill.uploadedAt } : null,
  };
}
