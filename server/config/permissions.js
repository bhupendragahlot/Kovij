/**
 * Who may do what. The single place staff permissions are defined on the server.
 *
 * Roles
 *   admin    gym owner: everything
 *   manager  runs the business: money, plans, reports, campaigns, people
 *   staff    front desk: members, check-ins, collecting payments, leads
 *   trainer  coaching: workouts, diets, progress, notes, attendance (no money, no settings)
 *
 * The frontend mirrors this map in kovij-fitness-zone/src/features/auth/permissionRules.js
 * (a unit test keeps the two identical). The server is the authority; the UI only hides
 * controls that would be refused.
 */
export const STAFF_ROLES = ['admin', 'manager', 'staff', 'trainer'];

const ALL = STAFF_ROLES;
const DESK = ['admin', 'manager', 'staff'];
const MANAGERS = ['admin', 'manager'];
const COACHES = ['admin', 'manager', 'trainer'];
const OWNER = ['admin'];

export const PERMISSIONS = {
  // Members
  'members.view': ALL,
  'members.edit': DESK,
  'members.health.view': ALL,
  'notes.manage': ALL,
  'communication.send': DESK,

  // Memberships and renewals
  'memberships.sell': DESK,
  'memberships.freeze': MANAGERS,
  'memberships.extend': MANAGERS,
  'membership.cancel': MANAGERS,
  'price.override': MANAGERS,
  'renewals.view': DESK,

  // Attendance
  'attendance.checkin': DESK,
  'attendance.view': ALL,

  // Money
  'payments.view': DESK,
  'payments.collect': DESK,
  'payments.refund': MANAGERS,
  'revenue.view': MANAGERS,
  'expenses.manage': MANAGERS,

  // Coaching
  'trainers.manage': MANAGERS,
  'workouts.manage': COACHES,
  'diets.manage': COACHES,
  'progress.manage': ['admin', 'manager', 'trainer', 'staff'],

  // Growth and communication
  'leads.manage': DESK,
  'plans.manage': MANAGERS,
  'campaigns.manage': MANAGERS,
  'announcements.manage': MANAGERS,
  'reminders.manage': MANAGERS,
  'reports.view': MANAGERS,
  'support.manage': DESK,

  // Administration
  'settings.manage': OWNER,
  'staff.manage': OWNER,
  'activity.view': OWNER,
};

/** @param {string} role @param {keyof PERMISSIONS} permission */
export const can = (role, permission) => Boolean(role && PERMISSIONS[permission]?.includes(role));
