/**
 * Member app data (TanStack Query). Keys start with "me" so signing out clears them in one go.
 * Every endpoint is a member endpoint: /api/member/… (own data only, enforced by the server).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mapi } from "./http";

export const meKeys = {
  all: ["me"],
  home: ["me", "home"],
  membership: ["me", "membership"],
  history: ["me", "membership", "history"],
  plans: ["me", "plans"],
  card: ["me", "card"],
  qr: ["me", "qr"],
  attendanceMonth: (month) => ["me", "attendance", "month", month],
  attendanceHistory: (page) => ["me", "attendance", "history", page],
  streak: ["me", "attendance", "streak"],
  dues: ["me", "dues"],
  payments: (page) => ["me", "payments", page],
  workout: ["me", "workout"],
  workoutLogs: ["me", "workout", "logs"],
  trainer: ["me", "trainer"],
  diet: ["me", "diet"],
  progress: ["me", "progress"],
  notifications: ["me", "notifications"],
  prefs: ["me", "notification-prefs"],
  announcements: ["me", "announcements"],
  support: ["me", "support"],
  ticket: (id) => ["me", "support", id],
  profile: ["me", "profile"],
  gym: ["gym", "public"],
};

const q = (key, url, opts = {}) => ({ queryKey: key, queryFn: () => mapi.get(url, opts.params), ...opts.query });

export const useHome = ({ enabled = true } = {}) => useQuery({ ...q(meKeys.home, "/member/home", { query: { staleTime: 60_000 } }), enabled });
export const useMyMembership = () => useQuery(q(meKeys.membership, "/member/membership", { query: { staleTime: 60_000 } }));
export const useMembershipHistory = () => useQuery(q(meKeys.history, "/member/membership/history"));
export const usePlans = () => useQuery(q(meKeys.plans, "/member/membership/plans", { query: { staleTime: 5 * 60_000 } }));
export const useMemberCard = () => useQuery(q(meKeys.card, "/member/membership/card"));
/** The QR pass is kept on the phone too (see PassPage) so it works without signal. */
export const useQrPass = () => useQuery(q(meKeys.qr, "/member/attendance/qr", { query: { staleTime: 60 * 60_000 } }));
export const useAttendanceMonth = (month) => useQuery(q(meKeys.attendanceMonth(month), "/member/attendance/month", { params: { month }, query: { placeholderData: keepPreviousData } }));
export const useAttendanceHistory = (page) => useQuery(q(meKeys.attendanceHistory(page), "/member/attendance/history", { params: { page, limit: 20 }, query: { placeholderData: keepPreviousData } }));
export const useStreak = () => useQuery(q(meKeys.streak, "/member/attendance/streak"));
export const useDues = () => useQuery(q(meKeys.dues, "/member/payments/dues", { query: { staleTime: 30_000 } }));
export const usePaymentHistory = (page = 1) => useQuery(q(meKeys.payments(page), "/member/payments", { params: { page, limit: 20 }, query: { placeholderData: keepPreviousData } }));
export const useWorkout = () => useQuery(q(meKeys.workout, "/member/workouts"));
export const useWorkoutLogs = () => useQuery(q(meKeys.workoutLogs, "/member/workouts/logs", { params: { limit: 10 } }));
export const useMyTrainer = () => useQuery(q(meKeys.trainer, "/member/trainer", { query: { staleTime: 5 * 60_000 } }));
export const useDiet = () => useQuery(q(meKeys.diet, "/member/diet"));
export const useProgress = () => useQuery(q(meKeys.progress, "/member/progress"));
export const useNotifications = () => useQuery(q(meKeys.notifications, "/member/notifications", { params: { limit: 30 } }));
export const useNotificationPrefs = () => useQuery(q(meKeys.prefs, "/member/notifications/preferences"));
export const useAnnouncements = () => useQuery(q(meKeys.announcements, "/member/announcements", { query: { staleTime: 5 * 60_000 } }));
export const useMyTickets = () => useQuery(q(meKeys.support, "/member/support"));
export const useMyTicket = (id) => useQuery({ ...q(meKeys.ticket(id), `/member/support/${id}`), enabled: Boolean(id) });
export const useMyProfile = () => useQuery(q(meKeys.profile, "/member/auth/profile"));
/** Public gym details: name, logo, hours, holidays, contact. */
export const useGym = () => useQuery(q(meKeys.gym, "/settings", { query: { staleTime: 10 * 60_000 } }));

function useMeMutation(mutationFn, invalidate = [], onSuccess) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data, vars) => {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: key });
      onSuccess?.(data, vars, queryClient);
    },
  });
}

/** Ask for a plan (new, renewal or change). The server prices it and raises the dues. */
export const useRequestPlan = () =>
  useMeMutation(({ planId, idempotencyKey }) => mapi.post("/member/membership/requests", { planId }, { idempotencyKey }), [meKeys.membership, meKeys.dues, meKeys.history, meKeys.home]);
export const useWithdrawRequest = () => useMeMutation((id) => mapi.post(`/member/membership/requests/${id}/cancel`, {}), [meKeys.membership, meKeys.dues, meKeys.history]);

export const useUpiIntent = (dueId) => useQuery({ queryKey: ["me", "upi", dueId], queryFn: () => mapi.get(`/member/payments/dues/${dueId}/upi`), enabled: Boolean(dueId) });
export const useSubmitUtr = () =>
  useMeMutation(({ dueId, utr, idempotencyKey }) => mapi.post(`/member/payments/dues/${dueId}/upi-reference`, { utr }, { idempotencyKey }), [meKeys.dues, meKeys.membership]);
export const useEmailReceipt = () => useMeMutation((paymentId) => mapi.post(`/member/payments/${paymentId}/email-receipt`, {}));

export const useLogWorkout = () =>
  useMeMutation(({ payload, idempotencyKey }) => mapi.post("/member/workouts/logs", payload, { idempotencyKey }), [meKeys.workout, meKeys.workoutLogs, meKeys.home]);

export const useTickMeal = (day) => useMeMutation(({ mealId, eaten }) => mapi.put(`/member/diet/days/${day}/meals/${mealId}`, { eaten }), [meKeys.diet]);
export const useWater = (day) => useMeMutation((glasses) => mapi.put(`/member/diet/days/${day}/water`, { glasses }), [meKeys.diet]);

export const useAddMeasurement = () =>
  useMeMutation((payload) => mapi.post("/member/progress/measurements", payload), [meKeys.progress, meKeys.home]);

export const useMarkAllRead = () => useMeMutation(() => mapi.post("/member/notifications/read-all", {}), [meKeys.notifications, meKeys.home]);
export const useMarkRead = () => useMeMutation((id) => mapi.post(`/member/notifications/${id}/read`, {}), [meKeys.notifications, meKeys.home]);
export const useUpdatePrefs = () => useMeMutation((patch) => mapi.patch("/member/notifications/preferences", patch), [meKeys.prefs]);

export const useOpenTicket = () =>
  useMeMutation(({ payload, idempotencyKey }) => mapi.post("/member/support", payload, { idempotencyKey }), [meKeys.support]);
export const useReplyTicket = (id) =>
  useMeMutation(({ text, idempotencyKey }) => mapi.post(`/member/support/${id}/messages`, { text }, { idempotencyKey }), [meKeys.support], (data, _v, qc) => qc.setQueryData(meKeys.ticket(id), data));
export const useResolveTicket = (id) => useMeMutation(() => mapi.post(`/member/support/${id}/resolve`, {}), [meKeys.support], (data, _v, qc) => qc.setQueryData(meKeys.ticket(id), data));

export const useUpdateProfile = () => useMeMutation((patch) => mapi.patch("/member/auth/profile", patch), [meKeys.profile, meKeys.card]);
