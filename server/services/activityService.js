/**
 * OWNER: security module. Turns staff requests into readable activity entries.
 *
 * Pure helpers (routePattern, describeRoute, pickResultFacts, describeActivity) are unit-tested;
 * recordActivity is called fire-and-forget by middleware/activityLog.js after the response.
 */
import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import { logger } from '../utils/logger.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** `/api/admin/members/66f…/memberships?x=1` → `/admin/members/:id/memberships` */
export function routePattern(url) {
  return String(url || '')
    .split('?')[0]
    .replace(/^\/api(?=\/|$)/, '')
    .split('/')
    .map((seg) => (OBJECT_ID.test(seg) ? ':id' : /^\d{4}-\d{2}-\d{2}$/.test(seg) ? ':day' : seg))
    .join('/')
    .replace(/\/+$/, '') || '/';
}

/**
 * [method, pattern, action key, sentence]. In sentences, {member} / {member’s} / {amount} are
 * filled in when known; a part in [brackets] is dropped when its value isn't known.
 */
const ACTIONS = [
  ['POST', '/admin/members', 'member.create', 'registered {member}'],
  ['PATCH', '/admin/members/:id', 'member.update', 'edited {member’s} details'],
  ['POST', '/admin/members/:id/photo', 'member.photo', 'updated {member’s} photo'],
  ['DELETE', '/admin/members/:id/photo', 'member.photo_remove', 'removed {member’s} photo'],
  ['POST', '/admin/members/:id/memberships', 'membership.sell', 'sold a plan to {member}'],
  ['POST', '/admin/members/:id/memberships/:id/cancel', 'membership.cancel', 'cancelled {member’s} plan'],
  ['POST', '/admin/members/:id/notify', 'member.email', 'emailed {member}'],
  ['POST', '/admin/memberships/:id/freeze', 'membership.freeze', 'froze {member’s} plan'],
  ['POST', '/admin/memberships/:id/unfreeze', 'membership.unfreeze', 'unfroze {member’s} plan'],
  ['POST', '/admin/memberships/:id/extend', 'membership.extend', 'added free days to {member’s} plan'],

  ['POST', '/admin/payments', 'payment.record', 'recorded a payment[ of {amount}][ from {member}]'],
  ['POST', '/admin/payments/:id/collect', 'payment.collect', 'collected a payment[ of {amount}][ from {member}]'],
  ['POST', '/admin/payments/:id/verify', 'payment.verify', 'checked a UPI payment[ of {amount}][ from {member}]'],
  ['POST', '/admin/payments/:id/refund', 'payment.refund', 'recorded a refund[ of {amount}][ to {member}]'],
  ['POST', '/admin/payments/:id/send-receipt', 'payment.receipt', 'sent a receipt[ to {member}]'],
  ['POST', '/admin/expenses', 'expense.create', 'added an expense[ of {amount}]'],
  ['PATCH', '/admin/expenses/:id', 'expense.update', 'edited an expense'],
  ['DELETE', '/admin/expenses/:id', 'expense.delete', 'deleted an expense'],
  ['PUT', '/admin/expenses/:id/bill', 'expense.bill', 'attached a bill to an expense'],
  ['DELETE', '/admin/expenses/:id/bill', 'expense.bill_remove', 'removed a bill from an expense'],

  ['POST', '/admin/attendance', 'attendance.checkin', 'checked in {member}'],
  ['POST', '/admin/attendance/scan', 'attendance.scan', 'scanned {member’s} QR code'],
  ['POST', '/admin/attendance/:id/check-out', 'attendance.checkout', 'checked out {member}'],
  ['DELETE', '/admin/attendance/:id/check-out', 'attendance.checkout_undo', 'undid {member’s} check-out'],
  ['DELETE', '/admin/attendance/:id', 'attendance.delete', 'removed a visit[ by {member}]'],
  ['POST', '/admin/attendance/members/:id/qr/reissue', 'attendance.qr_reissue', 'issued a new QR code for {member}'],

  ['POST', '/admin/leads', 'lead.create', 'added an enquiry'],
  ['PATCH', '/admin/leads/:id', 'lead.update', 'updated an enquiry'],
  ['POST', '/admin/leads/:id/notes', 'lead.note', 'added a note to an enquiry'],
  ['POST', '/admin/leads/:id/convert', 'lead.convert', 'turned an enquiry into a member[: {member}]'],
  ['POST', '/admin/leads/:id/triage', 'lead.triage', 're-sorted an enquiry'],

  ['POST', '/admin/trainers', 'trainer.create', 'added a trainer'],
  ['PATCH', '/admin/trainers/:id', 'trainer.update', 'edited a trainer'],
  ['DELETE', '/admin/trainers/:id', 'trainer.delete', 'removed a trainer'],
  ['POST', '/admin/trainers/:id/photo', 'trainer.photo', 'updated a trainer’s photo'],
  ['POST', '/admin/trainers/:id/members', 'trainer.assign', 'assigned members to a trainer'],
  ['DELETE', '/admin/trainers/:id/members/:id', 'trainer.unassign', 'removed {member} from a trainer'],

  ['POST', '/admin/workouts', 'workout.create', 'created a workout plan'],
  ['PATCH', '/admin/workouts/:id', 'workout.update', 'edited a workout plan'],
  ['DELETE', '/admin/workouts/:id', 'workout.delete', 'archived a workout plan'],
  ['POST', '/admin/workouts/:id/duplicate', 'workout.duplicate', 'copied a workout plan'],
  ['POST', '/admin/workouts/:id/assign', 'workout.assign', 'assigned a workout plan'],
  ['PATCH', '/admin/workouts/assignments/:id', 'workout.assignment_update', 'changed[ {member’s}] workout plan'],
  ['POST', '/admin/workouts/assignments/:id/end', 'workout.assignment_end', 'ended[ {member’s}] workout plan'],
  ['POST', '/admin/workouts/members/:id/logs', 'workout.log', 'logged a workout for {member}'],
  ['DELETE', '/admin/workouts/logs/:id', 'workout.log_delete', 'deleted a workout log'],
  ['POST', '/admin/exercise-assignments/members/:id', 'exercise.assign', 'scheduled exercises for {member}'],
  ['PATCH', '/admin/exercise-assignments/:id', 'exercise.assignment_update', 'changed an exercise for {member}'],
  ['POST', '/admin/exercise-assignments/:id/cancel', 'exercise.assignment_cancel', 'removed an exercise from {member’s} schedule'],
  ['POST', '/admin/exercise-assignments/:id/complete', 'exercise.assignment_complete', 'marked an exercise done for {member}'],
  ['POST', '/admin/exercise-assignments/:id/reopen', 'exercise.assignment_reopen', 'marked an exercise not done for {member}'],
  ['POST', '/admin/exercises', 'exercise.create', 'added an exercise'],
  ['PATCH', '/admin/exercises/:id', 'exercise.update', 'edited an exercise'],
  ['DELETE', '/admin/exercises/:id', 'exercise.delete', 'removed an exercise'],

  ['POST', '/admin/diets', 'diet.create', 'created a diet plan'],
  ['PUT', '/admin/diets/:id', 'diet.update', 'edited a diet plan'],
  ['PATCH', '/admin/diets/:id', 'diet.update', 'edited a diet plan'],
  ['DELETE', '/admin/diets/:id', 'diet.delete', 'removed a diet plan'],
  ['POST', '/admin/diets/:id/duplicate', 'diet.duplicate', 'copied a diet plan'],
  ['POST', '/admin/diets/members/:id/assign', 'diet.assign', 'gave {member} a diet plan'],
  ['POST', '/admin/diets/members/:id/stop', 'diet.stop', 'stopped {member’s} diet plan'],
  ['PUT', '/admin/diets/members/:id/days/:day/meals/:mealId', 'diet.log', 'updated {member’s} food log'],
  ['POST', '/admin/diets/members/:id/days/:day/items', 'diet.log', 'updated {member’s} food log'],
  ['DELETE', '/admin/diets/members/:id/days/:day/items/:itemId', 'diet.log', 'updated {member’s} food log'],
  ['PUT', '/admin/diets/members/:id/days/:day/water', 'diet.log', 'updated {member’s} water log'],

  ['POST', '/admin/members/:id/progress/entries', 'progress.create', 'added measurements for {member}'],
  ['PATCH', '/admin/members/:id/progress/entries/:id', 'progress.update', 'edited {member’s} measurements'],
  ['DELETE', '/admin/members/:id/progress/entries/:id', 'progress.delete', 'deleted {member’s} measurements'],
  ['POST', '/admin/members/:id/progress/photos', 'progress.photo', 'added progress photos for {member}'],
  ['DELETE', '/admin/members/:id/progress/photos/:id', 'progress.photo_delete', 'deleted a progress photo of {member}'],
  ['POST', '/admin/members/:id/app-password/reset', 'member.app_password_reset', 'reset {member’s} app password to their date of birth'],
  ['POST', '/admin/members/:id/notes', 'note.create', 'added a note on {member}'],
  ['PATCH', '/admin/members/:id/notes/:id', 'note.update', 'edited a note on {member}'],
  ['DELETE', '/admin/members/:id/notes/:id', 'note.delete', 'deleted a note on {member}'],

  ['POST', '/admin/reminders/run', 'reminders.run', 'sent today’s reminders'],
  ['PATCH', '/admin/reminders/settings', 'reminders.settings', 'changed reminder settings'],
  ['POST', '/admin/announcements', 'announcement.create', 'drafted an announcement'],
  ['PATCH', '/admin/announcements/:id', 'announcement.update', 'edited an announcement'],
  ['POST', '/admin/announcements/:id/publish', 'announcement.publish', 'published an announcement'],
  ['POST', '/admin/announcements/:id/unpublish', 'announcement.unpublish', 'took down an announcement'],
  ['DELETE', '/admin/announcements/:id', 'announcement.delete', 'deleted an announcement'],
  ['POST', '/admin/notifications/messages', 'member.message', 'messaged {member}'],
  ['POST', '/campaigns', 'campaign.create', 'created an email campaign'],
  ['POST', '/campaigns/:id/send', 'campaign.send', 'sent an email campaign'],
  ['POST', '/campaigns/:id/test', 'campaign.test', 'sent a test campaign email'],

  ['POST', '/admin/support/:id/messages', 'support.reply', 'replied to a support request[ from {member}]'],
  ['PATCH', '/admin/support/:id', 'support.update', 'updated a support request[ from {member}]'],

  ['PATCH', '/admin/settings', 'settings.update', 'changed gym settings'],
  ['POST', '/admin/settings/logo', 'settings.logo', 'updated the gym logo'],
  ['DELETE', '/admin/settings/logo', 'settings.logo_remove', 'removed the gym logo'],
  ['POST', '/admin/settings/email/test', 'settings.email_test', 'sent a test email'],
  ['POST', '/admin/staff', 'staff.create', 'added a staff account'],
  ['PATCH', '/admin/staff/:id', 'staff.update', 'changed a staff account'],
  ['POST', '/admin/staff/:id/reset-link', 'staff.reset_link', 'sent a password reset link'],
  ['POST', '/auth/change-password', 'auth.change_password', 'changed their password'],
  ['POST', '/auth/reset-password', 'auth.reset_password', 'set a new password with an emailed link'],
  ['POST', '/plans', 'plan.create', 'added a plan'],
  ['PUT', '/plans/:id', 'plan.update', 'edited a plan'],
  ['PATCH', '/plans/:id', 'plan.update', 'edited a plan'],
  ['DELETE', '/plans/:id', 'plan.delete', 'removed a plan'],
  ['POST', '/products', 'product.create', 'added a product'],
  ['POST', '/products/image', 'product.image', 'uploaded a product photo'],
  ['PUT', '/products/:id', 'product.update', 'edited a product'],
  ['DELETE', '/products/:id', 'product.delete', 'removed a product'],
];

/** Sub-path params that aren't ids (meal ids etc. may not be ObjectIds). */
const loosen = (pattern) => new RegExp(`^${pattern.replace(/:(\w+)/g, (_, name) => (name === 'id' ? ':id' : name === 'day' ? ':day' : '[^/]+'))}$`);
const ACTION_INDEX = ACTIONS.map(([method, pattern, key, sentence]) => ({ method, re: loosen(pattern), key, sentence }));

const KIND = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };
const singular = (word) => String(word || 'record').replace(/-/g, ' ').replace(/ies$/, 'y').replace(/s$/, '');

/** Which kind of change a staff request is, and which record it touched. */
export function describeRoute(method, url) {
  const route = routePattern(url);
  const rawSegments = String(url || '').split('?')[0].replace(/^\/api(?=\/|$)/, '').split('/').filter(Boolean);
  const named = rawSegments.filter((s) => s !== 'admin' && !OBJECT_ID.test(s));

  // The member a request is about: the id right after "members" in the path.
  const mIdx = rawSegments.indexOf('members');
  const pathMemberId = mIdx >= 0 && OBJECT_ID.test(rawSegments[mIdx + 1] || '') ? rawSegments[mIdx + 1] : undefined;
  const ids = rawSegments.filter((s) => OBJECT_ID.test(s));

  const match = ACTION_INDEX.find((a) => a.method === method && a.re.test(route));
  const entityType = rawSegments[0] === 'admin' ? rawSegments[1] : rawSegments[0];
  let kind = KIND[method] || 'other';
  if (match && /\/(send|test|run|publish|unpublish|verify|collect|refund|convert|triage|notify|scan|duplicate|assign|reissue|reset-link|freeze|unfreeze|extend|cancel|end|stop)$/.test(route)) kind = 'other';
  return {
    route,
    action: match?.key || `${entityType}.${kind}`,
    sentence: match?.sentence || `${{ create: 'added', update: 'changed', delete: 'deleted', other: 'changed' }[kind]} a ${singular(named.at(-1) === 'photo' ? 'photo' : entityType)}`,
    kind,
    entityType,
    entityId: ids.at(-1),
    memberId: pathMemberId,
  };
}

const idString = (v) => {
  const s = v == null ? '' : String(v._id || v);
  return OBJECT_ID.test(s) ? s : undefined;
};

/**
 * A few facts from a JSON response: which member it was about and how much money moved.
 * Never keeps the body itself.
 */
export function pickResultFacts(body) {
  if (!body || typeof body !== 'object') return {};
  let memberId;
  let amount;
  let entityId;
  const objects = Object.entries(body).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
  for (const [key, obj] of objects) {
    if (!memberId) memberId = key === 'member' ? idString(obj._id || obj.id) : idString(obj.memberId);
    if (!entityId && key !== 'member') entityId = idString(obj._id || obj.id);
    if (amount === undefined && ['payment', 'refund', 'expense', 'collection'].includes(key) && Number.isFinite(Number(obj.amount))) {
      amount = Number(obj.amount);
    }
  }
  if (!memberId) memberId = idString(body.memberId);
  if (amount === undefined && typeof body.amount === 'number') amount = body.amount;
  return { memberId, amount, entityId };
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Fill a sentence from ACTIONS with what we know. */
export function fillSentence(sentence, { member, amount } = {}) {
  const values = { member: member || '', amount: Number.isFinite(amount) ? inr.format(amount) : '' };
  return String(sentence || '')
    .replace(/\[([^\]]*)\]/g, (_, part) => {
      const names = [...part.matchAll(/\{(\w+)(?:’s)?\}/g)].map((m) => m[1]);
      return names.every((n) => values[n]) ? part : '';
    })
    .replace(/\{member’s\}/g, values.member ? `${values.member}’s` : 'a member’s')
    .replace(/\{member\}/g, values.member || 'a member')
    .replace(/\{amount\}/g, values.amount)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** "Priya collected ₹1,500 from Rahul Verma" */
export function describeActivity(entry, { memberName } = {}) {
  const { sentence } = ACTION_INDEX.find((a) => a.key === entry.action) || {};
  const what = fillSentence(sentence || describeRoute(entry.method, entry.route).sentence, { member: memberName, amount: entry.amount });
  return `${entry.actor?.name || 'Someone'} ${what}`;
}

/** Short device label from a user agent, for the log ("Chrome on Android"). */
export function deviceLabel(ua = '') {
  const s = String(ua);
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : '';
  const os = /Android/.test(s) ? 'Android' : /iPhone|iPad|iPod/.test(s) ? 'iPhone' : /Windows/.test(s) ? 'Windows' : /Mac OS X/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : '';
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || (s ? 'Other device' : 'Unknown device');
}

/** Save an entry; never throws (the request it describes has already been answered). */
export async function recordActivity(entry) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await ActivityLog.create(entry);
  } catch (err) {
    logger.warn(`activity log write failed: ${err.message}`);
  }
}
