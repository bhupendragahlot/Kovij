import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";

export const supportKeys = {
  all: ["support"],
  list: (params) => ["support", "list", params],
  detail: (id) => ["support", "detail", id],
};

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));

export function useSupportInbox(params) {
  const p = clean(params);
  return useQuery({ queryKey: supportKeys.list(p), queryFn: () => api.get("/admin/support", p), placeholderData: keepPreviousData, refetchInterval: 60_000 });
}

/** Opening a request marks it read, so the list and dashboard counts refresh afterwards. */
export function useSupportTicket(id) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: supportKeys.detail(id),
    queryFn: async () => {
      const data = await api.get(`/admin/support/${id}`);
      queryClient.invalidateQueries({ queryKey: ["support", "list"] });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
      return data.ticket;
    },
    enabled: Boolean(id),
  });
}

function useTicketMutation(id, mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.setQueryData(supportKeys.detail(id), data.ticket);
      queryClient.invalidateQueries({ queryKey: ["support", "list"] });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** Reply (idempotent: a retried send doesn't email the member twice). */
export const useSupportReply = (id) => useTicketMutation(id, ({ payload, idempotencyKey }) => api.post(`/admin/support/${id}/messages`, payload, { idempotencyKey }));

export const useUpdateSupport = (id) => useTicketMutation(id, (patch) => api.patch(`/admin/support/${id}`, patch));
