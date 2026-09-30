import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { notificationKeys } from "../notifications/api";

/** Which channels can reach this member, and the last few things they were sent. */
export function useMemberChannels(memberId, { enabled = true } = {}) {
  return useQuery({
    queryKey: notificationKeys.member(memberId),
    queryFn: () => api.get(`/admin/notifications/members/${memberId}`),
    enabled: enabled && Boolean(memberId),
  });
}

/** Message one member. Idempotent: a retried send reaches them once. */
export function useSendMemberMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post("/admin/notifications/messages", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
