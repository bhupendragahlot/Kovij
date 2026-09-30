import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { notificationKeys } from "../notifications/api";

export const reminderKeys = {
  all: ["reminders"],
  overview: ["reminders", "overview"],
  preview: (date) => ["reminders", "preview", date],
  stats: (days) => ["reminders", "stats", days],
};

/** Settings, last and next run, and whether email and phone notifications can deliver. */
export function useReminderOverview() {
  return useQuery({ queryKey: reminderKeys.overview, queryFn: () => api.get("/admin/reminders/overview") });
}

/** Who gets which reminder on `date` (today by default). Sends nothing. */
export function useReminderPreview(date) {
  return useQuery({ queryKey: reminderKeys.preview(date), queryFn: () => api.get("/admin/reminders/preview", date ? { date } : undefined) });
}

export function useReminderStats(days = 30) {
  return useQuery({ queryKey: reminderKeys.stats(days), queryFn: () => api.get("/admin/reminders/stats", { days }) });
}

/**
 * "Send now". The caller passes an Idempotency-Key from useIdempotencyKey(); retries reuse it,
 * and every reminder has its own once-only key on the server, so nobody is messaged twice.
 */
export function useRunReminders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey }) => api.post("/admin/reminders/run", {}, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: qk.members.all });
    },
  });
}

/** Save reminder settings (owner and managers). Keeps the cached settings in step. */
export function useUpdateReminderSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => api.patch("/admin/reminders/settings", patch),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.settings, (old) => (old?.settings ? { ...old, settings: { ...old.settings, reminders: data.reminders } } : old));
      queryClient.invalidateQueries({ queryKey: qk.settings });
      queryClient.invalidateQueries({ queryKey: reminderKeys.all });
    },
  });
}
