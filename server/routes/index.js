/**
 * Every API mount point, in one table. Each router file is owned by one module (see
 * docs/platform/README.md). Modules add endpoints inside their own router files; they do not
 * edit this table. More specific paths are mounted before the routers they sit under.
 */
import emailRoutes from './emailRoutes.js';
import authRoutes from './authRoutes.js';
import publicTrainerRoutes from './trainerRoutes.js';
import productRoutes from './productRoutes.js';
import planRoutes from './planRoutes.js';
import publicSettingsRoutes from './settingsRoutes.js';
import memberAuthRoutes from './memberAuthRoutes.js';
import legacyMembershipRoutes from './membershipRoutes.js';
import legacyPaymentRoutes from './paymentRoutes.js';
import campaignRoutes from './campaignRoutes.js';
import adminMemberRoutes from './adminMemberRoutes.js';
import adminPaymentRoutes from './adminPaymentRoutes.js';
import webhookRoutes from './webhookRoutes.js';

import dashboardRoutes from './admin/dashboardRoutes.js';
import attendanceRoutes from './admin/attendanceRoutes.js';
import leadRoutes from './admin/leadRoutes.js';
import trainerRoutes from './admin/trainerRoutes.js';
import settingsRoutes from './admin/settingsRoutes.js';
import staffRoutes from './admin/staffRoutes.js';
import membershipOpsRoutes from './admin/membershipOpsRoutes.js';
import expenseRoutes from './admin/expenseRoutes.js';
import financeRoutes from './admin/financeRoutes.js';
import workoutRoutes from './admin/workoutRoutes.js';
import exerciseRoutes from './admin/exerciseRoutes.js';
import exerciseDbRoutes from './admin/exerciseDbRoutes.js';
import exerciseAssignmentRoutes from './admin/exerciseAssignmentRoutes.js';
import dietRoutes from './admin/dietRoutes.js';
import progressRoutes from './admin/progressRoutes.js';
import memberNoteRoutes from './admin/memberNoteRoutes.js';
import reminderRoutes from './admin/reminderRoutes.js';
import announcementRoutes from './admin/announcementRoutes.js';
import adminNotificationRoutes from './admin/notificationRoutes.js';
import activityRoutes from './admin/activityRoutes.js';
import reportRoutes from './admin/reportRoutes.js';
import adminSupportRoutes from './admin/supportRoutes.js';

import memberMembershipRoutes from './member/membershipRoutes.js';
import memberPaymentRoutes from './member/paymentRoutes.js';
import memberAttendanceRoutes from './member/attendanceRoutes.js';
import memberWorkoutRoutes from './member/workoutRoutes.js';
import memberExerciseRoutes from './member/exerciseRoutes.js';
import memberTrainerRoutes from './member/trainerRoutes.js';
import memberDietRoutes from './member/dietRoutes.js';
import memberProgressRoutes from './member/progressRoutes.js';
import memberNotificationRoutes from './member/notificationRoutes.js';
import memberAnnouncementRoutes from './member/announcementRoutes.js';
import memberSupportRoutes from './member/supportRoutes.js';
import memberHomeRoutes from './member/homeRoutes.js';

/** [path, router] in mount order. */
export const MOUNTS = [
  // Public website, auth, webhooks
  ['/', emailRoutes],
  ['/auth', authRoutes],
  ['/trainers', publicTrainerRoutes],
  ['/products', productRoutes],
  ['/plans', planRoutes],
  ['/settings', publicSettingsRoutes],
  ['/webhooks', webhookRoutes],

  // Member app (member token)
  ['/member/auth', memberAuthRoutes],
  ['/member/home', memberHomeRoutes],
  ['/member/membership', memberMembershipRoutes],
  ['/member/payments', memberPaymentRoutes],
  ['/member/attendance', memberAttendanceRoutes],
  ['/member/workouts', memberWorkoutRoutes],
  ['/member/exercises', memberExerciseRoutes],
  ['/member/trainer', memberTrainerRoutes],
  ['/member/diet', memberDietRoutes],
  ['/member/progress', memberProgressRoutes],
  ['/member/notifications', memberNotificationRoutes],
  ['/member/announcements', memberAnnouncementRoutes],
  ['/member/support', memberSupportRoutes],
  // Legacy member endpoints used by the current member portal
  ['/membership', legacyMembershipRoutes],
  ['/payments', legacyPaymentRoutes],

  // Staff app (staff token)
  ['/campaigns', campaignRoutes],
  ['/admin/members/:memberId/progress', progressRoutes],
  ['/admin/members/:memberId/notes', memberNoteRoutes],
  ['/admin/members', adminMemberRoutes],
  ['/admin/memberships', membershipOpsRoutes],
  ['/admin/payments', adminPaymentRoutes],
  ['/admin/expenses', expenseRoutes],
  ['/admin/finance', financeRoutes],
  ['/admin/dashboard', dashboardRoutes],
  ['/admin/attendance', attendanceRoutes],
  ['/admin/leads', leadRoutes],
  ['/admin/trainers', trainerRoutes],
  ['/admin/workouts', workoutRoutes],
  ['/admin/exercises', exerciseRoutes],
  ['/admin/exercisedb', exerciseDbRoutes],
  ['/admin/exercise-assignments', exerciseAssignmentRoutes],
  ['/admin/diets', dietRoutes],
  ['/admin/reminders', reminderRoutes],
  ['/admin/announcements', announcementRoutes],
  ['/admin/notifications', adminNotificationRoutes],
  ['/admin/settings', settingsRoutes],
  ['/admin/staff', staffRoutes],
  ['/admin/activity', activityRoutes],
  ['/admin/reports', reportRoutes],
  ['/admin/support', adminSupportRoutes],
];

export function mountApiRoutes(apiRouter) {
  for (const [path, router] of MOUNTS) apiRouter.use(path, router);
}
