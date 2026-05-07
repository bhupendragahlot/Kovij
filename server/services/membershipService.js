import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import Plan from '../models/Plan.js';

dayjs.extend(utc);

/** Map existing Plan.duration enum to approximate days */
export function planDurationToDays(plan) {
  if (plan?.durationInDays != null && Number.isFinite(Number(plan.durationInDays))) {
    return Math.max(1, Math.floor(Number(plan.durationInDays)));
  }
  const map = { day: 1, week: 7, month: 30, year: 365 };
  const d = plan?.duration;
  return map[d] ?? 30;
}

export function parsePlanPrice(plan) {
  const p = plan?.price;
  const n = typeof p === 'number' ? p : parseFloat(String(p).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {Date} start
 * @param {import('../models/Plan.js').default} plan
 */
export function computeEndDate(start, plan) {
  const days = planDurationToDays(plan);
  return dayjs(start).add(days, 'day').toDate();
}

/**
 * Remaining value credit from current plan (simple linear proration).
 * @param {Date} now
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} oldPlanPrice
 */
export function prorationCredit(now, startDate, endDate, oldPlanPrice) {
  const totalMs = Math.max(1, new Date(endDate) - new Date(startDate));
  const leftMs = Math.max(0, new Date(endDate) - new Date(now));
  const ratio = leftMs / totalMs;
  return Math.round(oldPlanPrice * ratio * 100) / 100;
}

/**
 * @param {string} planId
 */
export async function getPlanOrThrow(planId) {
  const plan = await Plan.findById(planId);
  if (!plan || plan.status === 'Inactive') {
    const err = new Error('Plan not found or inactive');
    err.statusCode = 404;
    err.code = 'PLAN_NOT_FOUND';
    throw err;
  }
  return plan;
}
