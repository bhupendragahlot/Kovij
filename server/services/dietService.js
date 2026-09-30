/**
 * Diet plans (templates), giving a plan to a member, and the member's daily nutrition log.
 *
 * Rules
 *  - A template is copied when assigned, so template edits never change a member's plan.
 *  - A member has at most one current-or-upcoming plan. A new plan ends the old one where the
 *    new one starts; history is kept.
 *  - Days are gym days (Asia/Kolkata). A log can be filled in for today and the last week.
 *  - Every total is computed in code from the plan copy and the log (wellnessMath.js).
 */
import DietPlan from '../models/DietPlan.js';
import DietAssignment from '../models/DietAssignment.js';
import NutritionLog from '../models/NutritionLog.js';
import { getSettingsDoc } from '../models/Settings.js';
import { AppError } from '../middleware/errorHandler.js';
import { toObjectId, withTransaction } from '../utils/db.js';
import { escapeRegex } from '../utils/strings.js';
import { gymDayKey } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { notifyMember } from './notify.js';
import './emailTemplates/wellnessTemplates.js';
import { dayBounds, dayOffset, daysBetween, normalizeFoodItem, nutritionDay, planInEffect, shiftDay, sumMacros } from './wellnessMath.js';

export const DIET_POLICY = {
  logDaysBack: 7, // a missed day can be filled in up to a week later
  waterTargetGlasses: 8,
  maxExtrasPerDay: 30,
  assignDaysBack: 7, // a plan can be back-dated a week (entered late)…
  assignDaysAhead: 30, // …or start up to a month ahead
};

// ── Presentation ────────────────────────────────────────────────────────────

const presentItem = (it) => ({
  _id: it._id,
  food: it.food,
  quantity: it.quantity || '',
  calories: it.calories ?? 0,
  proteinG: it.proteinG ?? 0,
  carbsG: it.carbsG ?? 0,
  fatG: it.fatG ?? 0,
});

const presentMeal = (m) => ({
  _id: m._id,
  name: m.name,
  time: m.time || '',
  items: (m.items || []).map(presentItem),
  totals: sumMacros(m.items || []),
});

/** Targets with blanks dropped: `{}` when none were set. */
function cleanTargets(t) {
  const out = {};
  for (const k of ['calories', 'proteinG', 'carbsG', 'fatG']) if (typeof t?.[k] === 'number') out[k] = t[k];
  return out;
}

export function presentPlan(doc, extra = {}) {
  const meals = (doc.meals || []).map(presentMeal);
  return {
    _id: doc._id,
    name: doc.name,
    goal: doc.goal,
    dietType: doc.dietType,
    targets: cleanTargets(doc.targets),
    notes: doc.notes || '',
    archived: Boolean(doc.archived),
    meals,
    totals: sumMacros(meals.map((m) => m.totals)),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...extra,
  };
}

function assignmentState(a, now) {
  if (a.status === 'active' && new Date(a.startDate) > dayBounds(gymDayKey(now)).end) return 'upcoming';
  return planInEffect([a], gymDayKey(now)) ? 'current' : 'ended';
}

export function presentAssignment(a, now = new Date()) {
  const plan = presentPlan(a.plan);
  return {
    _id: a._id,
    planId: a.planId,
    state: assignmentState(a, now),
    startDay: a.startDay,
    startDate: a.startDate,
    endedAt: a.endedAt || null,
    note: a.note || '',
    assignedByName: a.assignedByName || '',
    createdAt: a.createdAt,
    name: plan.name,
    goal: plan.goal,
    dietType: plan.dietType,
    targets: plan.targets,
    notes: plan.notes,
    meals: plan.meals,
    totals: plan.totals,
  };
}

const presentAssignmentSummary = (a, now) => ({
  _id: a._id,
  planId: a.planId,
  state: assignmentState(a, now),
  name: a.plan.name,
  dietType: a.plan.dietType,
  startDay: a.startDay,
  startDate: a.startDate,
  endedAt: a.endedAt || null,
  assignedByName: a.assignedByName || '',
});

const presentExtra = (x) => ({ ...presentItem(x), addedByKind: x.addedByKind, addedAt: x.addedAt });

function presentDay({ day, assignment, log, now }) {
  const targets = assignment ? cleanTargets(assignment.plan.targets) : null;
  const n = nutritionDay({ meals: assignment?.plan.meals || [], eatenMealIds: log?.eatenMealIds || [], extras: log?.extras || [], targets });
  const offset = dayOffset(day, now);
  return {
    day,
    editable: offset <= 0 && offset >= -DIET_POLICY.logDaysBack,
    plan: assignment ? { _id: assignment._id, name: assignment.plan.name } : null,
    targets,
    meals: n.meals.map((r) => ({ ...presentMeal(r.meal), eaten: r.eaten })),
    extras: (log?.extras || []).map(presentExtra),
    water: { glasses: log?.waterGlasses || 0, target: DIET_POLICY.waterTargetGlasses },
    totals: { eaten: n.eaten, planned: n.planned },
    remainingCalories: n.remainingCalories,
    mealsEaten: n.mealsEaten,
    mealsPlanned: n.mealsPlanned,
  };
}

// ── Templates ───────────────────────────────────────────────────────────────

/** Validated input → stored shape (items normalised, blank targets dropped). */
function planFields(input) {
  return {
    name: input.name,
    goal: input.goal,
    dietType: input.dietType,
    targets: cleanTargets(input.targets),
    notes: input.notes || '',
    meals: (input.meals || []).map((m) => ({ name: m.name, time: m.time || '', items: (m.items || []).map(normalizeFoodItem) })),
  };
}

export async function listPlans({ q, dietType, archived = false, page = 1, limit = 50 }) {
  const filter = { archived: Boolean(archived) };
  if (dietType) filter.dietType = dietType;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');

  const [rows, total, counts] = await Promise.all([
    DietPlan.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    DietPlan.countDocuments(filter),
    DietPlan.aggregate([{ $group: { _id: '$archived', n: { $sum: 1 } } }]),
  ]);
  const usage = await DietAssignment.aggregate([
    { $match: { planId: { $in: rows.map((r) => r._id) }, status: 'active' } },
    { $group: { _id: '$planId', n: { $sum: 1 } } },
  ]);
  const usedBy = new Map(usage.map((u) => [String(u._id), u.n]));

  const plans = rows.map((r) => {
    const p = presentPlan(r);
    return {
      _id: p._id,
      name: p.name,
      goal: p.goal,
      dietType: p.dietType,
      targets: p.targets,
      archived: p.archived,
      totals: p.totals,
      mealCount: p.meals.length,
      mealNames: p.meals.map((m) => m.name),
      memberCount: usedBy.get(String(r._id)) || 0,
      updatedAt: p.updatedAt,
    };
  });
  const byArchived = Object.fromEntries(counts.map((c) => [c._id ? 'archived' : 'active', c.n]));
  return { plans, total, page, limit, counts: { active: byArchived.active || 0, archived: byArchived.archived || 0 } };
}

export async function getPlan(id) {
  const doc = await DietPlan.findById(id).lean();
  if (!doc) throw new AppError('Diet plan not found', 404, 'NOT_FOUND');
  const onPlan = await DietAssignment.find({ planId: doc._id, status: 'active' })
    .sort({ startDate: -1 })
    .limit(100)
    .select('memberId startDay startDate')
    .populate('memberId', 'name memberCode profilePhoto')
    .lean();
  return presentPlan(doc, {
    members: onPlan
      .filter((a) => a.memberId)
      .map((a) => ({ assignmentId: a._id, startDay: a.startDay, startDate: a.startDate, member: a.memberId })),
  });
}

export async function createPlan(input, staff) {
  const doc = await DietPlan.create({ ...planFields(input), createdBy: staff.id, updatedBy: staff.id });
  return presentPlan(doc.toObject(), { members: [] });
}

export async function updatePlan(id, input, staff) {
  const doc = await DietPlan.findByIdAndUpdate(id, { $set: { ...planFields(input), updatedBy: staff.id } }, { new: true, runValidators: true }).lean();
  if (!doc) throw new AppError('Diet plan not found', 404, 'NOT_FOUND');
  return getPlan(doc._id);
}

export async function setPlanArchived(id, archived, staff) {
  const doc = await DietPlan.findByIdAndUpdate(id, { $set: { archived, updatedBy: staff.id } }, { new: true }).lean();
  if (!doc) throw new AppError('Diet plan not found', 404, 'NOT_FOUND');
  return getPlan(doc._id);
}

export async function duplicatePlan(id, staff) {
  const src = await DietPlan.findById(id).lean();
  if (!src) throw new AppError('Diet plan not found', 404, 'NOT_FOUND');
  const name = `${src.name} (copy)`.slice(0, 100);
  const copy = planFields({ ...src, name, meals: src.meals.map((m) => ({ ...m, items: m.items.map(({ _id, ...it }) => it) })) });
  const doc = await DietPlan.create({ ...copy, createdBy: staff.id, updatedBy: staff.id });
  return presentPlan(doc.toObject(), { members: [] });
}

export async function deletePlan(id) {
  const plan = await DietPlan.findById(id).select('name').lean();
  if (!plan) throw new AppError('Diet plan not found', 404, 'NOT_FOUND');
  const following = await DietAssignment.countDocuments({ planId: plan._id, status: 'active' });
  if (following > 0) {
    throw new AppError(
      `${following === 1 ? '1 member is' : `${following} members are`} following this plan. Archive it instead, so it can't be given out again.`,
      409,
      'PLAN_IN_USE',
      { members: following }
    );
  }
  await DietPlan.deleteOne({ _id: plan._id });
}

// ── Giving a plan to a member ───────────────────────────────────────────────

/** Frozen copy of a template. Meals get fresh ids so ticks from an earlier copy never match. */
function snapshotOf(plan) {
  return {
    name: plan.name,
    goal: plan.goal,
    dietType: plan.dietType,
    targets: cleanTargets(plan.targets),
    notes: plan.notes || '',
    meals: (plan.meals || []).map((m) => ({ name: m.name, time: m.time || '', items: (m.items || []).map(({ _id, ...it }) => it) })),
  };
}

/** Everything that still applies at `cutoff` (not ended, or ending after it). */
const stillRunningAt = (memberId, cutoff) => ({
  memberId,
  $or: [{ endedAt: { $exists: false } }, { endedAt: null }, { endedAt: { $gt: cutoff } }],
});

/**
 * Give a template to a member from `startDay` (default today). Ends the previous plan where
 * this one starts, in one transaction, then tells the member (in-app, email, push).
 */
export async function assignDiet({ memberId, planId, startDay, note = '', staff, idempotencyKey, now = new Date() }) {
  const day = startDay || gymDayKey(now);
  const offset = dayOffset(day, now);
  if (offset < -DIET_POLICY.assignDaysBack || offset > DIET_POLICY.assignDaysAhead) {
    const message = `Choose a start date from ${DIET_POLICY.assignDaysBack} days ago to ${DIET_POLICY.assignDaysAhead} days ahead`;
    throw new AppError(message, 422, 'VALIDATION_ERROR', { fields: { startDay: message } });
  }

  // Backstop for a retried request whose first attempt already committed.
  if (idempotencyKey) {
    const existing = await DietAssignment.findOne({ idempotencyKey }).lean();
    if (existing) return { assignment: presentAssignment(existing, now), notified: false, replayed: true };
  }

  const plan = await DietPlan.findById(planId).lean();
  if (!plan) throw new AppError('Diet plan not found', 404, 'NOT_FOUND');
  if (plan.archived) throw new AppError('This plan is archived. Restore it before giving it to a member.', 409, 'PLAN_ARCHIVED');
  if (!plan.meals?.length) throw new AppError('Add at least one meal to this plan before giving it to a member.', 409, 'PLAN_EMPTY');

  const { start } = dayBounds(day);
  const assignment = await withTransaction(async (session) => {
    await DietAssignment.updateMany(stillRunningAt(memberId, start), { $set: { status: 'ended', endedAt: start, endedBy: staff.id } }, { session });
    const [created] = await DietAssignment.create(
      [
        {
          memberId,
          planId: plan._id,
          status: 'active',
          startDate: start,
          startDay: day,
          plan: snapshotOf(plan),
          note,
          assignedBy: staff.id,
          assignedByName: staff.name,
          idempotencyKey: idempotencyKey || undefined,
        },
      ],
      { session }
    );
    return created.toObject();
  });

  let notified = false;
  try {
    const settings = await getSettingsDoc();
    // No plan details in the title or body: they can show on a locked phone screen.
    const result = await notifyMember({
      memberId,
      kind: 'diet',
      title: offset > 0 ? 'Your new diet plan starts soon' : 'Your new diet plan is ready',
      body: 'Your trainer set up a diet plan for you. Open the app to see your meals and daily targets.',
      link: '/member/diet',
      email: { templateKey: 'dietPlanAssigned', vars: { planName: plan.name, startDate: start, trainerName: staff.name, gymName: settings.gymName } },
      preference: 'workoutUpdates',
      dedupeKey: `diet:${assignment._id}`,
      meta: { assignmentId: String(assignment._id) },
      createdBy: staff.id,
    });
    notified = Boolean(result.created);
  } catch (e) {
    logger.warn(`Diet plan notification failed for member ${memberId}: ${e.message}`);
  }

  return { assignment: presentAssignment(assignment, now), notified, replayed: false };
}

/** Stop the member's current (and any upcoming) plan now. */
export async function stopDiet({ memberId, staff, now = new Date() }) {
  const res = await DietAssignment.updateMany(stillRunningAt(memberId, now), { $set: { status: 'ended', endedAt: now, endedBy: staff.id } });
  if (!res.modifiedCount) throw new AppError('This member has no diet plan to stop', 409, 'NO_DIET_PLAN');
}

// ── Reading a member's diet ─────────────────────────────────────────────────

/** Assignments that may apply somewhere between two instants. */
function assignmentsBetween(memberId, from, to) {
  return DietAssignment.find({ ...stillRunningAt(memberId, from), startDate: { $lte: to } })
    .sort({ startDate: -1 })
    .limit(50)
    .lean();
}

/** Current plan, upcoming plan, recent history and today's log. */
export async function dietOverview(memberId, now = new Date()) {
  const today = gymDayKey(now);
  const all = await DietAssignment.find({ memberId }).sort({ startDate: -1, _id: -1 }).limit(30).lean();
  const current = planInEffect(all, today);
  const upcoming = all.find((a) => a.status === 'active' && new Date(a.startDate) > dayBounds(today).end) || null;
  const log = await NutritionLog.findOne({ memberId, day: today }).lean();
  return {
    current: current ? presentAssignment(current, now) : null,
    upcoming: upcoming ? presentAssignment(upcoming, now) : null,
    past: all.filter((a) => a !== current && a !== upcoming).slice(0, 10).map((a) => presentAssignmentSummary(a, now)),
    today: presentDay({ day: today, assignment: current, log, now }),
  };
}

export async function listAssignments(memberId, now = new Date()) {
  const all = await DietAssignment.find({ memberId }).sort({ startDate: -1, _id: -1 }).limit(50).lean();
  return all.map((a) => presentAssignmentSummary(a, now));
}

export async function getDay(memberId, day, now = new Date()) {
  if (dayOffset(day, now) > 0) throw new AppError("That day hasn't happened yet", 422, 'DAY_IN_FUTURE');
  const { start, end } = dayBounds(day);
  const [assignments, log] = await Promise.all([assignmentsBetween(memberId, start, end), NutritionLog.findOne({ memberId, day }).lean()]);
  return presentDay({ day, assignment: planInEffect(assignments, day), log, now });
}

/** Daily totals against targets, newest day first. Days with neither a plan nor a log are skipped. */
export async function nutritionHistory(memberId, { days = 14, now = new Date() } = {}) {
  const today = gymDayKey(now);
  const from = shiftDay(today, -(days - 1));
  const fromStart = dayBounds(from).start;
  const toEnd = dayBounds(today).end;
  const [assignments, logs] = await Promise.all([
    assignmentsBetween(memberId, fromStart, toEnd),
    NutritionLog.find({ memberId, date: { $gte: fromStart, $lte: toEnd } }).lean(),
  ]);
  const byDay = new Map(logs.map((l) => [l.day, l]));
  const rows = [];
  for (const day of daysBetween(from, today)) {
    const a = planInEffect(assignments, day);
    const log = byDay.get(day);
    if (!a && !log) continue;
    const targets = a ? cleanTargets(a.plan.targets) : null;
    const n = nutritionDay({ meals: a?.plan.meals || [], eatenMealIds: log?.eatenMealIds || [], extras: log?.extras || [], targets });
    rows.push({
      day,
      planName: a?.plan.name || null,
      targets,
      eaten: n.eaten,
      planned: n.planned,
      mealsEaten: n.mealsEaten,
      mealsPlanned: n.mealsPlanned,
      waterGlasses: log?.waterGlasses || 0,
      logged: Boolean(log),
    });
  }
  const logged = rows.filter((r) => r.logged);
  const avg = (pick) => (logged.length ? Math.round(logged.reduce((s, r) => s + pick(r), 0) / logged.length) : null);
  return {
    from,
    to: today,
    days: rows,
    summary: {
      daysLogged: logged.length,
      avgCalories: avg((r) => r.eaten.calories),
      avgWaterGlasses: avg((r) => r.waterGlasses),
      waterTarget: DIET_POLICY.waterTargetGlasses,
    },
  };
}

// ── Writing the daily log ───────────────────────────────────────────────────

function assertLoggable(day, now) {
  const offset = dayOffset(day, now);
  if (offset > 0) throw new AppError("You can't log a day that hasn't happened yet", 422, 'DAY_IN_FUTURE');
  if (offset < -DIET_POLICY.logDaysBack) throw new AppError(`Only the last ${DIET_POLICY.logDaysBack} days can be changed`, 422, 'DAY_TOO_OLD');
}

/** One atomic update of a day's log, creating it if needed (retried once on a create race). */
async function updateLog(memberId, day, update, extraFilter = {}) {
  const filter = { memberId, day, ...extraFilter };
  const doc = { ...update, $setOnInsert: { date: dayBounds(day).start } };
  try {
    return await NutritionLog.updateOne(filter, doc, { upsert: true });
  } catch (e) {
    if (e?.code !== 11000) throw e;
    return NutritionLog.updateOne(filter, doc, { upsert: true });
  }
}

export async function setMealEaten({ memberId, day, mealId, eaten, now = new Date() }) {
  assertLoggable(day, now);
  const { start, end } = dayBounds(day);
  const assignment = planInEffect(await assignmentsBetween(memberId, start, end), day);
  if (!assignment) throw new AppError('There is no diet plan for this day', 409, 'NO_DIET_PLAN');
  if (!assignment.plan.meals.some((m) => String(m._id) === String(mealId))) {
    throw new AppError("This meal isn't in the plan any more. Refresh and try again.", 404, 'MEAL_NOT_FOUND');
  }
  const op = eaten ? '$addToSet' : '$pull';
  await updateLog(memberId, day, { [op]: { eatenMealIds: toObjectId(mealId) } });
  return getDay(memberId, day, now);
}

export async function addExtraItem({ memberId, day, item, actor, now = new Date() }) {
  assertLoggable(day, now);
  const extra = { ...normalizeFoodItem(item), addedByKind: actor.kind, addedBy: actor.id, addedAt: now };
  try {
    // The index condition caps the list atomically: a full day matches nothing and the upsert collides.
    await updateLog(memberId, day, { $push: { extras: extra } }, { [`extras.${DIET_POLICY.maxExtrasPerDay - 1}`]: { $exists: false } });
  } catch (e) {
    if (e?.code === 11000) throw new AppError(`You can add up to ${DIET_POLICY.maxExtrasPerDay} extra items a day`, 422, 'TOO_MANY_ITEMS');
    throw e;
  }
  return getDay(memberId, day, now);
}

export async function removeExtraItem({ memberId, day, itemId, now = new Date() }) {
  assertLoggable(day, now);
  const res = await NutritionLog.updateOne({ memberId, day }, { $pull: { extras: { _id: toObjectId(itemId) } } });
  if (!res.modifiedCount) throw new AppError('That item was already removed', 404, 'NOT_FOUND');
  return getDay(memberId, day, now);
}

export async function setWater({ memberId, day, glasses, now = new Date() }) {
  assertLoggable(day, now);
  await updateLog(memberId, day, { $set: { waterGlasses: glasses } });
  return getDay(memberId, day, now);
}
