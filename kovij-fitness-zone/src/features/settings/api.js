import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => api.get("/admin/settings"),
    select: (d) => d.settings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) => api.patch("/admin/settings", patch),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.settings, data);
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useStaff({ enabled = true } = {}) {
  return useQuery({ queryKey: qk.staff, queryFn: () => api.get("/admin/staff"), select: (d) => d.staff, enabled });
}

export function useSaveStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => (id ? api.patch(`/admin/staff/${id}`, payload) : api.post("/admin/staff", payload)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.staff }),
  });
}
