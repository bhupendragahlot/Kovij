import { getSettingsDoc } from '../models/Settings.js';
import {
  listReminderRuns,
  previewReminders,
  reminderOverview,
  reminderStats,
  runReminders,
  updateReminderSettings,
} from '../services/reminderService.js';
import { listNotificationLog } from '../services/notificationService.js';
import { runAnnouncementsJob } from '../services/announcementService.js';
import { daysBetween, normalizeReminderSettings } from '../services/reminderRules.js';
import { runHousekeepingJob } from '../cron/expiryCron.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { GYM_TZ, dayjs, gymDayKey } from '../utils/time.js';

const PREVIEW_MAX_DAYS = 30;

/** GET /api/admin/reminders/overview — settings, last/next run, channel readiness, recent runs. */
export const getOverview = asyncHandler(async (req, res) => {
  const [overview, recentRuns] = await Promise.all([reminderOverview(), listReminderRuns(5)]);
  res.json({ success: true, ...overview, recentRuns });
});

/** GET /api/admin/reminders/preview?date=YYYY-MM-DD — who gets what that day. Sends nothing. */
export const getPreview = asyncHandler(async (req, res) => {
  const { date } = req.validated.query;
  const today = gymDayKey();
  let asOf = new Date();
  if (date && date !== today) {
    const ahead = daysBetween(today, date);
    if (ahead < 0 || ahead > PREVIEW_MAX_DAYS) {
      throw new AppError(`Pick today or a day in the next ${PREVIEW_MAX_DAYS} days`, 422, 'VALIDATION_ERROR', {
        fields: { date: `Pick today or a day in the next ${PREVIEW_MAX_DAYS} days` },
      });
    }
    // A later day is previewed as of its send hour.
    const { sendHour } = normalizeReminderSettings((await getSettingsDoc()).reminders);
    asOf = dayjs.tz(`${date} ${String(sendHour).padStart(2, '0')}:05`, GYM_TZ).toDate();
  }
  res.json({ success: true, ...(await previewReminders(asOf)) });
});

/** POST /api/admin/reminders/run — send today's reminders now (Idempotency-Key required). */
export const runNow = asyncHandler(async (req, res) => {
  const run = await runReminders(new Date(), { trigger: 'manual', staffId: req.staffUser.id });
  res.json({ success: true, run });
});

/** GET /api/admin/reminders/history — reminder notifications with how each channel went. */
export const getHistory = asyncHandler(async (req, res) => {
  const q = req.validated.query;
  res.json({ success: true, ...(await listNotificationLog({ ...q, group: q.kind ? undefined : 'reminders' })) });
});

/** GET /api/admin/reminders/stats?days=30 — per-stage counts. */
export const getStats = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await reminderStats(req.validated.query.days)) });
});

/** PATCH /api/admin/reminders/settings — reminder settings only (managers may change these). */
export const patchSettings = asyncHandler(async (req, res) => {
  const reminders = await updateReminderSettings(req.validated.body);
  res.json({ success: true, reminders });
});

/** POST /api/admin/reminders/test/run — NODE_ENV=test only: run jobs as of a chosen moment. */
export const testRun = asyncHandler(async (req, res) => {
  const { now, jobs, memberIds } = req.validated.body;
  const out = {};
  if (jobs.includes('housekeeping')) out.housekeeping = await runHousekeepingJob(now);
  if (jobs.includes('preview')) out.preview = await previewReminders(now, { memberIds });
  if (jobs.includes('reminders')) {
    out.reminders = await runReminders(now, { trigger: 'test', staffId: req.staffUser.id, housekeeping: false, memberIds });
  }
  if (jobs.includes('announcements')) out.announcements = await runAnnouncementsJob(now);
  res.json({ success: true, ...out });
});
