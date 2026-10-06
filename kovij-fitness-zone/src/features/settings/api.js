import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, http } from "../../app/http";
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

/** Email a staff member a link to choose their own password. */
export function useSendResetLink() {
  return useMutation({ mutationFn: (id) => api.post(`/admin/staff/${id}/reset-link`, {}) });
}

/** Gym logo: upload (a resized image Blob) or remove. Both return the saved settings. */
export function useGymLogo() {
  const queryClient = useQueryClient();
  const onSuccess = (data) => {
    queryClient.setQueryData(qk.settings, data);
    queryClient.invalidateQueries({ queryKey: ["public-settings"] });
  };
  const upload = useMutation({
    mutationFn: (blob) => {
      const form = new FormData();
      form.append("photo", blob, blob.name || "logo.png");
      return http.post("/admin/settings/logo", form, { timeout: 60_000 }).then((r) => r.data);
    },
    onSuccess,
  });
  const remove = useMutation({ mutationFn: () => api.delete("/admin/settings/logo"), onSuccess });
  return { upload, remove };
}

/** Settings → Email: how the server sends email and how the last week went (owner). */
export function useEmailSetup({ enabled = true } = {}) {
  return useQuery({ queryKey: ["settings", "email"], queryFn: () => api.get("/admin/settings/email"), enabled });
}

/** Sends one test email and waits for the real result. */
export function useSendTestEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (to) => api.post("/admin/settings/email/test", { to: to || undefined }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["settings", "email"] }),
  });
}
