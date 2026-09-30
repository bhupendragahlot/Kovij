import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { invalidateMemberData, qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

export function useMembers(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: qk.members.list(params),
    queryFn: () => api.get("/admin/members", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMember(id) {
  return useQuery({
    queryKey: qk.members.detail(id),
    queryFn: () => api.get(`/admin/members/${id}`),
    enabled: Boolean(id),
  });
}

/** Live "this person may already be registered" hint while typing a phone/email. */
export function useDuplicateCheck({ phone, email, excludeId }) {
  const digits = String(phone || "").replace(/\D/g, "");
  const emailOk = /\S+@\S+\.\S+/.test(email || "");
  const params = { phone: digits.length >= 10 ? phone : undefined, email: emailOk ? email : undefined, excludeId };
  return useQuery({
    queryKey: qk.members.duplicates(params),
    queryFn: () => api.get("/admin/members/duplicates", params),
    enabled: Boolean(params.phone || params.email),
    staleTime: 60_000,
    select: (d) => d.matches,
  });
}

/** Desk registration (optionally with first plan + payment). Idempotent: safe to retry. */
export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post("/admin/members", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMemberData(queryClient),
  });
}

export function useUpdateMember(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.patch(`/admin/members/${memberId}`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.members.detail(memberId), (prev) => (prev ? { ...prev, member: { ...prev.member, ...data.member }, profile: data.profile } : prev));
      queryClient.invalidateQueries({ queryKey: qk.members.all });
    },
  });
}

/** Renew / switch / first plan. Idempotent because it may take money. */
export function useSellPlan(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post(`/admin/members/${memberId}/memberships`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMemberData(queryClient),
  });
}

export function useCancelMembership(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (membershipId) => api.post(`/admin/members/${memberId}/memberships/${membershipId}/cancel`),
    onSuccess: () => invalidateMemberData(queryClient),
  });
}

export function useNotifyMember(memberId) {
  return useMutation({
    mutationFn: (payload) => api.post(`/admin/members/${memberId}/notify`, payload),
  });
}
