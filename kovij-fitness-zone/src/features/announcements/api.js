import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { notificationKeys } from "../notifications/api";

export const announcementKeys = {
  all: ["announcements"],
  list: (params) => ["announcements", "list", params],
  audience: (audience) => ["announcements", "audience", audience],
};

export function useAnnouncements(params) {
  return useQuery({
    queryKey: announcementKeys.list(params),
    queryFn: () => api.get("/admin/announcements", params),
    placeholderData: keepPreviousData,
    // While a delivery is going out, keep its progress fresh.
    refetchInterval: (query) => (query.state.data?.items?.some((a) => ["pending", "running"].includes(a.delivery?.state)) ? 3000 : false),
  });
}

/** How many members an audience reaches (and how many haven't turned announcements off). */
export function useAudienceSize(audience, { enabled = true } = {}) {
  return useQuery({
    queryKey: announcementKeys.audience(audience),
    queryFn: () => api.get("/admin/announcements/audience", { audience }),
    enabled: enabled && Boolean(audience),
    staleTime: 60_000,
  });
}

export const fetchAudienceSize = (queryClient, audience) =>
  queryClient.fetchQuery({ queryKey: announcementKeys.audience(audience), queryFn: () => api.get("/admin/announcements/audience", { audience }), staleTime: 30_000 });

function useAnnouncementMutation(fn, extra = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...extra,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export const useSaveAnnouncement = () =>
  useAnnouncementMutation(({ id, payload }) => (id ? api.patch(`/admin/announcements/${id}`, payload) : api.post("/admin/announcements", payload)));

/** Publishing notifies the whole audience, so it carries an Idempotency-Key and retries safely. */
export const usePublishAnnouncement = () =>
  useAnnouncementMutation(({ id, idempotencyKey }) => api.post(`/admin/announcements/${id}/publish`, {}, { idempotencyKey }), {
    retry: retryIdempotent,
    retryDelay,
  });

export const useUnpublishAnnouncement = () => useAnnouncementMutation((id) => api.post(`/admin/announcements/${id}/unpublish`));

export const useDeleteAnnouncement = () => useAnnouncementMutation((id) => api.delete(`/admin/announcements/${id}`));
