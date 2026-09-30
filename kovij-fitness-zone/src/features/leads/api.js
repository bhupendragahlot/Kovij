import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";

export function useLeads(params) {
  return useQuery({
    queryKey: qk.leads.list(params),
    queryFn: () => api.get("/admin/leads", params),
    placeholderData: keepPreviousData,
  });
}

function useLeadMutation(fn, { onSuccess } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.leads.all });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
      onSuccess?.(data, vars, queryClient);
    },
  });
}

export const useCreateLead = () => useLeadMutation((payload) => api.post("/admin/leads", payload));

export const useUpdateLead = () => useLeadMutation(({ id, patch }) => api.patch(`/admin/leads/${id}`, patch));

export const useAddLeadNote = () => useLeadMutation(({ id, text }) => api.post(`/admin/leads/${id}/notes`, { text }));

export const useConvertLead = () =>
  useLeadMutation((id) => api.post(`/admin/leads/${id}/convert`), {
    onSuccess: (data, vars, queryClient) => queryClient.invalidateQueries({ queryKey: qk.members.all }),
  });
